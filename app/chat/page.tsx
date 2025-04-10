"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Volume2, Subtitles, ArrowLeft, Send } from "lucide-react"
import { Button } from "../components/ui/button"
import VoiceAnimation from "../components/VoiceAnimation"
import styles from '../page.module.css'
import ReactMarkdown from "react-markdown"
import AgentChat from "../components/AgentChat"

export default function ChatPage() {
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(true)
  const [captionsOn, setCaptionsOn] = useState(false)
  const [typedText, setTypedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const [showAgent, setShowAgent] = useState(false)
  const [showHealthInfo, setShowHealthInfo] = useState(false)
  const [agentKey, setAgentKey] = useState(0)
  const [lastActivityTime, setLastActivityTime] = useState(Date.now())
  const videoRef = useRef<HTMLVideoElement>(null)
  const didAgentContainerRef = useRef<HTMLDivElement>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // WebRTC connection states
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null)
  const [apiKey, setApiKey] = useState<string>('')
  const [isKeyValid, setIsKeyValid] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const audioElement = useRef<HTMLAudioElement | null>(null)
  
  // Add a new state for tracking chat interface visibility
  const [showChatInterface, setShowChatInterface] = useState(false)

  // Add this with the other state variables
  const [isVoiceQueryLoading, setIsVoiceQueryLoading] = useState(false)

  // Add a new state for tracking if the doubt agent is shown
  const [showDoubtAgent, setShowDoubtAgent] = useState(false)

  const fullText = "Improve Your Health Literacy"

  // Add agent configuration
  const agentId = "agt_yzHfQcKi"
  const clientKey = "Z29vZ2xlLW9hdXRoMnwxMDI0ODA0ODY0NDQzMzI1ODU0ODQ6UmQteWt1N29nc3dBcGFCazU4c1hO"

  useEffect(() => {
    if (started && typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.substring(0, typedText.length + 1))
      }, 100)
      return () => clearTimeout(timeout)
    } else if (typedText.length === fullText.length) {
      setIsTyping(false)
    }
  }, [started, typedText, fullText])

  useEffect(() => {
    // Auto-play video muted when component mounts
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(error => {
        console.log("Auto-play failed:", error);
        // Auto-play might be blocked by browser policy
      });
    }
    
    // Fetch API key and start WebRTC connection
    fetchApiKey();
  }, []);

  // Fetch API key from server
  async function fetchApiKey() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/get-api-key');
      const data = await response.json();
      
      if (data.apiKey) {
        console.log("API key fetched successfully");
        setApiKey(data.apiKey);
        const isValid = await validateApiKey(data.apiKey);
        console.log("API key validation after fetch:", isValid);
        setIsKeyValid(isValid);
        // Don't start session automatically - wait for button click
      } else {
        console.error('API key not found in response');
        setError('API key not found');
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
      setError('Failed to fetch API key');
    } finally {
      setIsLoading(false);
    }
  }

  // Validate API key
  async function validateApiKey(key: string) {
    try {
      if (!key || key.trim() === '') {
        setIsKeyValid(false);
        return false;
      }

      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });
      
      const isValid = response.ok;
      console.log("API key validation result:", isValid);
      setIsKeyValid(isValid);
      return isValid;
    } catch (error) {
      console.error("Error validating API key:", error);
      setIsKeyValid(false);
      return false;
    }
  }

  // Start WebRTC session
  async function startSession(key: string) {
    try {
      setIsLoading(true);
      if (!key) {
        alert("No API key available");
        setIsLoading(false);
        return;
      }
      
      const EPHEMERAL_KEY = key;
      
      const pc = new RTCPeerConnection();

      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => {
        if (audioElement.current) {
          audioElement.current.srcObject = e.streams[0];
        }
      };

      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      pc.addTrack(ms.getTracks()[0]);

      const dc = pc.createDataChannel("oai-events");
      setDataChannel(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`API request failed: ${errorText}`);
      }

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer as RTCSessionDescriptionInit);

      peerConnection.current = pc;
      setIsLoading(false);
      console.log("WebRTC session started successfully");
    } catch (error: any) {
      console.error("Error starting session:", error);
      setIsLoading(false);
    }
  }

  // Stop WebRTC session
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current?.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
    setMessages([]);
  }

  // Send client event to WebRTC
  function sendClientEvent(message: any) {
    if (dataChannel && dataChannel.readyState === 'open') {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      dataChannel.send(JSON.stringify(message));

      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - data channel not available or not open",
        message,
        dataChannel ? `Channel state: ${dataChannel.readyState}` : "No channel"
      );
    }
  }

  // Send text message to WebRTC
  function sendTextMessage(message: string) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: message
    }]);

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  // Set up WebRTC data channel event listeners
  useEffect(() => {
    if (dataChannel) {
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        setEvents((prev) => [event, ...prev]);
        
        // Process incoming messages for the chat UI
        if (event.type === "conversation.item.create" && event.item?.role === "assistant") {
          const content = event.item.content.map((c: any) => {
            if (c.type === "text") return c.text;
            return '';
          }).join(' ');
          
          setMessages(prev => [...prev, {
            id: event.event_id || crypto.randomUUID(),
            role: 'assistant',
            content: content,
            type: 'message'
          }]);
        }
        // Handle audio transcripts
        else if (event.type === "response.audio_transcript.done" && event.transcript) {
          setMessages(prev => [...prev, {
            id: event.event_id || crypto.randomUUID(),
            role: 'assistant',
            content: event.transcript,
            type: 'transcript'
          }]);
        }
      });

      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
        
        // Add a welcome message
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Welcome to Acolyte Health! I\'m ready to assist you.',
          type: 'message'
        }]);
      });
    }
  }, [dataChannel]);

  const handleVideoEnd = () => {
    setVideoEnded(true)
  }

  const handleStart = () => {
    setStarted(true)
    setIsTyping(true)
    setTypedText("")
    
    // Unmute and restart the video when Start is clicked
    if (videoRef.current) {
      videoRef.current.currentTime = 0; // Reset to beginning
      videoRef.current.muted = false;
      setMuted(false);
      videoRef.current.play()
      
      // Add event listener to detect when video ends
      videoRef.current.onended = handleVideoEnd
    }
  }

  const handleChatWithLynn = () => {
    // Start WebRTC session when Chat with Lynn is clicked
    if (isKeyValid && !isSessionActive) {
      startSession(apiKey);
    }
    
    setShowAgent(true);
    setShowHealthInfo(true);
    
    // Optionally pause the video if it's still playing
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  };

  const handleAskDoubt = () => {
    // Show the doubt agent when Ask Doubt is clicked
    setShowDoubtAgent(true);
    
    // Also set showHealthInfo to true to display the same left-side content as "Chat with Lynn"
    setShowHealthInfo(true);
    
    // Optionally pause the video if it's still playing
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted
      setMuted(!muted)
    }
  }

  const toggleCaptions = () => {
    setCaptionsOn(!captionsOn)
    // Implementation for captions would go here
  }

  // Voice recording functions
  const startRecording = async () => {
    setIsRecording(true);
    // Here you would implement actual voice recording and transcription
  };
  
  const stopRecording = () => {
    setIsRecording(false);
    // In a real implementation, you would stop the MediaRecorder here
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Logo for mobile only - at the very top - hide when in chat mode on mobile */}
      {!(showAgent && showHealthInfo) && !(showDoubtAgent && showHealthInfo) && (
        <div className="p-4 md:hidden">
          <div className="flex items-center gap-2">
            <img 
              src="/Side-text.png" 
              alt="Acolyte Health Logo" 
              className="h-8"
            />
          </div>
        </div>
      )}

      <main className="flex flex-col md:flex-row flex-1 relative">
        {/* Left side content - hide on mobile when in chat mode */}
        <div className={`w-full md:w-1/2 p-4 md:p-8 flex flex-col justify-between relative z-10 order-2 md:order-1 ${(showAgent && showHealthInfo) || (showDoubtAgent && showHealthInfo) ? 'hidden md:flex' : ''}`}>
          {/* Logo - visible only on md screens and up */}
          <div className="mb-5 hidden md:block">
            <div className="flex items-center gap-2">
              <img 
                src="/Side-text.png" 
                alt="Acolyte Health Logo" 
                className="h-10"
              />
            </div>
          </div>

          {/* Main content - text, button, and disclaimer side by side on larger screens */}
          <div className="flex-1 flex flex-col justify-center items-center gap-6 md:gap-8">
            <div className="flex flex-col items-center w-full max-w-lg">
              {!showHealthInfo ? (
                <>
                  <h1 className="text-3xl md:text-4xl font-light text-neutral-800 mb-4 md:mb-6 text-center w-full">
                    {!started ? "Hello! Welcome to Acolyte Health!" : typedText}
                  </h1>
                  
                  {started && (
                    <p className="text-base md:text-lg text-neutral-600 mb-4 md:mb-6 text-center">
                      Keep your health literacy up to date with personalized learning.
                    </p>
                  )}

                  {!started ? (
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white py-3 md:py-4 px-6 md:px-8 rounded-md text-base md:text-lg font-medium w-full mt-3 md:mt-4 mb-0"
                      onClick={handleStart}
                      disabled={isLoading}
                    >
                      {isLoading ? "Connecting..." : "Start"}
                    </Button>
                  ) : (
                    <div className="flex flex-col w-full gap-3">
                      <Button
                        className="bg-teal-600 hover:bg-teal-700 text-white py-3 md:py-4 px-6 md:px-8 rounded-md text-base md:text-lg font-medium w-full"
                        onClick={handleChatWithLynn}
                        disabled={isLoading || !isKeyValid}
                      >
                        {isLoading ? "Connecting..." : "Chat with Lynn"}
                      </Button>
                      <Button
                        className="bg-pink-600 hover:bg-pink-700 text-white py-3 md:py-4 px-6 md:px-8 rounded-md text-base md:text-lg font-medium w-full"
                        onClick={handleAskDoubt}
                        disabled={isLoading}
                      >
                        Ask Doubt
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-teal-600">
                        <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="25" cy="25" r="23" stroke="currentColor" strokeWidth="4"/>
                          <path d="M15 25L22 32L35 18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl md:text-3xl font-medium text-teal-600">Improving Health Literacy</h2>
                        <p className="text-gray-600 text-lg">Personalized Learning in 120 Languages</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-8">
                    <h3 className="text-2xl text-gray-600 mb-4 text-left">Leads to...</h3>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-1">•</span>
                        <span className="text-xl text-gray-500">Fewer avoidable hospitalizations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-1">•</span>
                        <span className="text-xl text-gray-500">Fewer hospital readmissions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-1">•</span>
                        <span className="text-xl text-gray-500">Fewer emergency department visits</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-1">•</span>
                        <span className="text-xl text-gray-500">Lower cost per beneficiary</span>
                      </li>
                    </ul>
                  </div>
                  
                  <h3 className="text-2xl text-gray-600 mb-4 text-left">Happier and Healthier Members!</h3>
                </div>
              )}
              
              {/* Disclaimer with centered text and privacy policy link below - only show when not in chat mode */}
              {!showHealthInfo && (
                <div className="mt-8 flex flex-col items-center w-full">
                  <p className="text-xs text-neutral-600 mb-3 text-center">
                    You are interacting with an AI avatar for informational and interactive purposes. 
                    Responses are generated by an automated system and may not reflect human
                    advice. Please do not share personal health information. This platform does not offer
                    medical advice and is not a substitute for consultation with a healthcare
                    professional.
                  </p>
                  <Link href="https://acolytehealth.com/privacy-policy/" className="text-teal-600 hover:text-teal-700 text-sm">
                    Privacy Policy
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side - video, VoiceAnimation, or AgentChat */}
        <div className={`w-full ${(showAgent && showHealthInfo) || (showDoubtAgent && showHealthInfo) ? 'md:w-1/2' : 'md:w-1/2'} relative order-1 md:order-2 h-[40vh] ${(showAgent && showHealthInfo) || (showDoubtAgent && showHealthInfo) ? 'h-screen' : 'md:h-full'}`}>
          {!showAgent && !showDoubtAgent ? (
            <>
              {/* Video element */}
              <video 
                ref={videoRef}
                className="w-full h-full object-cover" 
                autoPlay={false}
                muted={muted}
                loop={false}
                onEnded={handleVideoEnd}
                playsInline
              >
                <source src="/Lynn.mp4" type="video/mp4" />
              </video>
              
              {/* Controls */}
              <div className="absolute top-4 right-4 flex gap-3">
                <button 
                  className={`p-2 rounded-full ${muted ? 'bg-gray-200 text-gray-600' : 'bg-white text-teal-600'}`}
                  onClick={toggleMute}
                >
                  <Volume2 size={20} />
                </button>
                <button 
                  className={`p-2 rounded-full ${captionsOn ? 'bg-gray-200 text-gray-600' : 'bg-white text-teal-600'}`}
                  onClick={toggleCaptions}
                >
                  <Subtitles size={20} />
                </button>
              </div>
            </>
          ) : showDoubtAgent ? (
            // Show AgentChat for Ask Doubt
            <AgentChat 
              agentId={agentId}
              clientKey={clientKey}
              onActivity={() => {
                console.log("Agent activity detected");
              }}
            />
          ) : (
            // Use VoiceAnimation component for Chat with Lynn
            <VoiceAnimation 
              onSwitchToChat={() => {
                // Always start a new WebRTC session when switching to chat
                if (isKeyValid) {
                  // If there's an existing session, stop it first
                  if (isSessionActive) {
                    stopSession();
                  }
                  // Start a new session
                  startSession(apiKey);
                }
                setShowChatInterface(true);
              }}
              stopSession={stopSession}
              isRecording={isRecording}
              startRecording={startRecording}
              stopRecording={stopRecording}
            />
          )}
        </div>
      </main>

      {/* Add a chat interface component that shows when showChatInterface is true */}
      {showAgent && showHealthInfo && showChatInterface && (
        <div className="absolute top-0 right-0 bottom-0 md:w-1/2 w-full bg-white flex flex-col z-20">
          {/* Chat header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <img 
                src="/Side-text.png" 
                alt="Acolyte Health Logo" 
                className="h-8"
              />
            </div>
            <button 
              onClick={() => setShowChatInterface(false)}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
            >
              <ArrowLeft size={20} />
            </button>
          </div>
          
          {/* Chat messages - updated to match App.tsx style */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3 md:space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="mr-1 md:mr-2 flex items-start pt-2">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-[#3CBFAE] flex items-center justify-center text-white font-bold text-xs md:text-base">
                        {m.type === 'transcript' ? <Volume2 className="w-3 h-3 md:w-4 md:h-4" /> : 'AI'}
                      </div>
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] md:max-w-[75%] p-2 md:p-4 rounded-lg shadow-sm text-sm md:text-base ${
                      m.role === 'user'
                        ? 'bg-[#D94B87] text-white'
                        : m.type === 'transcript'
                          ? 'bg-gray-100 border border-gray-200'
                          : 'bg-white border border-gray-200'
                    }`}
                  >
                    {m.type === 'transcript' && (
                      <div className="text-xs md:text-sm text-gray-500 mb-1">Transcript</div>
                    )}
                    <div className={`prose max-w-none prose-sm md:prose-base ${m.type === 'transcript' ? 'text-gray-800' : ''}`}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="mr-1 md:mr-2 flex items-start pt-2">
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-[#3CBFAE] flex items-center justify-center text-white font-bold text-xs md:text-base">
                      AI
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-2 md:p-4 rounded-lg shadow-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#3CBFAE] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#3CBFAE] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#3CBFAE] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Chat input - updated to match App.tsx style */}
          <div className="border-t p-4">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
                if (input.value.trim() && isSessionActive) {
                  sendTextMessage(input.value.trim());
                  input.value = '';
                }
              }}
              className="flex space-x-2 h-full items-center"
            >
              <textarea
                name="message"
                placeholder="Type your message here..."
                className="flex-1 p-2 md:p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBFAE] transition-all resize-none text-sm md:text-base"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="flex flex-col space-y-2">
                {isVoiceQueryLoading && (
                  <div className="absolute right-12 md:right-16 bottom-16 bg-[#3CBFAE]/10 text-[#3CBFAE] px-2 py-1 rounded text-xs">
                    Fetching context...
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!isSessionActive || isVoiceQueryLoading}
                  className="p-2 bg-[#D94B87] text-white rounded-md hover:bg-[#C43A76] disabled:opacity-50"
                >
                  <Send className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}