'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import SessionControls from './SessionControls';
import { Settings, Plus, MessageCircle, FileText, Send, Menu, X, Loader, Users, Volume2, VolumeX, Mic, Square, Home } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import VoiceAnimation from './VoiceAnimation';

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [apiKey, setApiKey] = useState<string>(process.env.NEXT_PUBLIC_OPENAI_API_KEY1 || '');
  const [isKeyValid, setIsKeyValid] = useState(false);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const audioElement = useRef<HTMLAudioElement | null>(null);
  const [userId] = useState(() => uuidv4());
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScoreRubricOpen, setIsScoreRubricOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const [voiceQueryContext, setVoiceQueryContext] = useState<string>('');
  const [isVoiceQueryLoading, setIsVoiceQueryLoading] = useState(false);
  const [showChatInterface, setShowChatInterface] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasStartedConversation, setHasStartedConversation] = useState(false);

  const handleNewChat = () => {
    if (isSessionActive) {
      stopSession();
    }
    setMessages([]);
    setInput('');
    setVoiceQueryContext('');
  };

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

  async function startSession() {
    try {
      setIsLoading(true);
      if (!apiKey) {
        alert("Please enter your OpenAI API key");
        setIsLoading(false);
        return;
      }
      
      if (!isKeyValid) {
        const valid = await validateApiKey(apiKey);
        if (!valid) {
          alert("Invalid API key. Please check and try again.");
          setIsLoading(false);
          return;
        }
      }
      
      const EPHEMERAL_KEY = apiKey;
      
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
      setShowChatInterface(false);
    } catch (error: any) {
      console.error("Error starting session:", error);
      alert(`Failed to start session: ${error.message}`);
      setIsLoading(false);
    }
  }

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
  const systemPrompt1 = `This Teach-Back is an activity where the user practices a skill they just learned in an online course. Refer to the course storyboard as well as the course assessment to provide you with context. This activity will be scored and should reference only the material in the uploaded documents. You may reference other material in your feedback, but the scoring should be based solely on the course content. This activity is in section 2.5 of course 103. I have outlined how the activity is structured below.

When the user clicks "begin", briefly describe the activity as a teach-back in which they'll receive personalized feedback based on their answer. Also, state the two rubric areas (Comprehensiveness and Clarity & Structure, each accounting for 4 points) and what a passing score is. Then, show the question: "Explain how drug pricing methodologies impact the cost of pharmaceuticals and why this matters in pharmacy benefits consulting." After they submit their answer, grade them based on the rubric below and show them what their score is on each rubric area, as well as what could be done to improve. Continue providing guidance to improve their answer until they get a score of 8/8, then summarize their response into a final statement and congratulate them. Instruct them to proceed in the course.

When a user clicks "instructions", explain in detail how the activity works and highlight that they are aiming for mastery and you will support them in achieving it. Show the full rubric and what their response should include (the 3 bullets below).

The user's response should include:

✔ A clear definition of key drug pricing methodologies, such as AWP, WAC, MAC, and NADAC.

✔ An explanation of how these methodologies influence drug costs and reimbursement structures.

✔ A connection to pharmacy benefits consulting, including how these methodologies affect pricing strategies and cost-containment efforts.

Evaluation Criteria: The user's response will be scored based on the rubric below, with a total of 8 possible points. To pass, they need at least 6 points.

Scoring Rubric (8 Points Total)

Scoring & Feedback Rubric: 4) Excellent 3) Good 2) Fair 1) Poor

Comprehensiveness:

4: Clearly defines drug pricing methodologies, explains their cost impact, and connects them to pharmacy benefits consulting.

3: Mentions drug pricing methodologies and cost impact but lacks full explanation or consulting connection.

2: Provides a vague or incomplete definition of drug pricing methodologies with little explanation of cost impact or relevance to consulting.

1: Response is unclear, incorrect, or missing key details.

Clarity & Structure:

4: Explanation is clear, well-organized, and easy to follow.

3: Mostly clear but could be better structured or more concise.

2: Somewhat unclear or disorganized.

1: Hard to follow or confusing.

✅ Passing Score: 6+ out of 8

Exemplar Response:

Drug pricing methodologies such as AWP, WAC, MAC, and NADAC define how drug costs are determined and reimbursed. AWP is a benchmark for pharmacy pricing, WAC is the manufacturer's list price, MAC caps reimbursement for generics, and NADAC reflects actual pharmacy acquisition costs. These methodologies influence pharmacy pricing, employer drug spend, and PBM negotiations. Understanding them allows pharmacy benefits consultants to optimize cost-containment strategies and ensure fair pricing structures for clients.`;
  async function sendTextMessage(message: string) {
    // Create a clean version for display (without the system prompt)
    const displayMessage = message;
    
    // Check if we should get context from voice-query API
    setIsVoiceQueryLoading(true);
    try {
      const response = await fetch('/api/voice-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          userId: userId,
          apiKey: apiKey,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch context');
      }
      
      const data = await response.json();
      if (data.context) {
        setVoiceQueryContext(data.context);
      }
    } catch (error) {
      console.error('Error fetching context:', error);
    } finally {
      setIsVoiceQueryLoading(false);
    }
    
    // Create the full message with system prompt for sending to the API
    const fullMessage = message + " ";
    console.log(voiceQueryContext);
    // If we have context from voice-query, add it to the message
    const contextEnhancedMessage = voiceQueryContext 
      ? `${fullMessage}\n\nRelevant context: ${voiceQueryContext} \n\n ${systemPrompt1}`
      : `${fullMessage}\n\n${systemPrompt1}`;
    
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: contextEnhancedMessage,
          },
        ],
      },
    };

    // Add only the display message to the UI
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayMessage
    }]);

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
    setInput('');
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !isSessionActive) return;
    
    sendTextMessage(input.trim());
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          
          // Automatically switch to chat interface when receiving a message
          setShowChatInterface(true);
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
          content: 'Welcome to the Acolyte Health Realtime Console! I\'m ready to assist you.',
          type: 'message'
        }]);
      });
    }
  }, [dataChannel]);

  useEffect(() => {
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
    
    fetchApiKey();
  }, []);

  const InstructionsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Instructions</h3>
            <button 
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto">
            <div className="prose dark:prose-invert max-w-none">
              <h4 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">About This Console</h4>
              <p className="text-gray-800 dark:text-gray-300">
                This is a realtime console that allows you to interact with Acolyte Health's AI assistant.
              </p>
              
              <h4 className="text-lg font-medium mt-5 mb-3 text-gray-900 dark:text-white">How to Use</h4>
              <ol className="list-decimal pl-5 my-3 text-gray-800 dark:text-gray-300">
                <li>Enter your OpenAI API key</li>
                <li>Click "Connect" to validate your key</li>
                <li>Start a session to begin communicating with the model</li>
                <li>Send messages and view the realtime responses</li>
                <li>Use the tools panel to access additional features</li>
              </ol>
              
              <h4 className="text-lg font-medium mt-5 mb-3 text-gray-900 dark:text-white">Tips</h4>
              <ul className="list-disc pl-5 my-3 text-gray-800 dark:text-gray-300">
                <li>Your API key is never stored permanently</li>
                <li>The event log shows all communication with the API</li>
                <li>You can stop the session at any time</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
            <button
              onClick={onClose}
              className="bg-[#3CBFAE] text-white px-4 py-2 rounded-md hover:bg-[#35a99a] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ScoreRubricModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Scoring Rubric (8 Points Total)</h3>
            <button 
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Comprehensiveness Section */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Comprehensiveness (4 points)</h4>
                <ul className="space-y-2 text-gray-800 dark:text-gray-300">
                  <li><strong>4:</strong> Clearly defines methodologies, explains impact, connects to consulting</li>
                  <li><strong>3:</strong> Mentions methodologies and impact, lacks full connection</li>
                  <li><strong>2:</strong> Vague definitions, little explanation</li>
                  <li><strong>1:</strong> Unclear or incorrect response</li>
                </ul>
              </div>

              {/* Clarity & Structure Section */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Clarity & Structure (4 points)</h4>
                <ul className="space-y-2 text-gray-800 dark:text-gray-300">
                  <li><strong>4:</strong> Clear, well-organized explanation</li>
                  <li><strong>3:</strong> Mostly clear, needs better structure</li>
                  <li><strong>2:</strong> Somewhat unclear or disorganized</li>
                  <li><strong>1:</strong> Hard to follow or confusing</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t dark:border-gray-700">
              <p className="text-green-600 dark:text-green-400 font-medium">Passing Score: 6+ out of 8</p>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
            <button
              onClick={onClose}
              className="bg-[#3CBFAE] text-white px-4 py-2 rounded-md hover:bg-[#35a99a] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const VoiceRecorder = ({ onTranscription, disabled, systemPrompt }: { onTranscription: (text: string) => void, disabled?: boolean, systemPrompt: string }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingError, setRecordingError] = useState<string | null>(null);
    
    const startRecording = async () => {
      setIsRecording(true);
      setRecordingError(null);
      
      try {
        // Here you would implement actual voice recording and transcription
        // For now, we'll simulate it with a timeout
        setTimeout(() => {
          const simulatedTranscription = "This is a simulated voice transcription";
          onTranscription(simulatedTranscription);
          setIsRecording(false);
        }, 2000);
        
        // In a real implementation, you would:
        // 1. Record audio using MediaRecorder API
        // 2. Send the audio to a transcription service
        // 3. Get the transcription and call onTranscription with the result
      } catch (error) {
        console.error('Error recording voice:', error);
        setRecordingError('Failed to record audio');
        setIsRecording(false);
      }
    };
    
    const stopRecording = () => {
      setIsRecording(false);
      // In a real implementation, you would stop the MediaRecorder here
    };
    
    return (
      <div>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || !isSessionActive}
          className={`p-2 rounded-full transition-all duration-200 ${
            isRecording ? 'bg-red-500 text-white' : 'bg-gray-100'
          } hover:bg-opacity-90 disabled:opacity-50`}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
          type="button"
        >
          {isRecording ? (
            <Square className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4 text-gray-600" />
          )}
        </button>
        {recordingError && <div className="text-red-500 text-xs mt-1">{recordingError}</div>}
      </div>
    );
  };

  const startRecording = async () => {
    setIsRecording(true);
    // Here you would implement actual voice recording and transcription
    // For now, we'll just set the state
    
    // In a real implementation, you would:
    // 1. Record audio using MediaRecorder API
    // 2. Send the audio to a transcription service
    // 3. Get the transcription and use it as input
  };
  
  const stopRecording = () => {
    setIsRecording(false);
    // In a real implementation, you would stop the MediaRecorder here
    // and process the recorded audio
    
    // For demo purposes, let's add a simulated message after stopping recording
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'user',
        content: "This is a simulated voice message"
      }]);
      
      // Simulate assistant response
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "I've received your voice message. How can I help you with pharmacy benefits?"
        }]);
      }, 1000);
    }, 500);
  };

  return (
    <>
      <motion.nav 
        className="absolute top-0 left-0 right-0 h-16 flex items-center bg-[#3CBFAE] text-white shadow-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 md:gap-4 w-full mx-2 md:mx-4 pb-2">
          <div className="bg-white p-1 md:p-2 rounded-md">
            <Image 
              src="/Side-text.svg" 
              alt="Acolyte Health Logo" 
              width={24} 
              height={24}
              className="w-12 md:w-20 h-6 md:h-15"
            />
          </div>
          <motion.h1
            className="text-sm md:text-xl font-bold truncate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Acolyte Health Realtime Assistant
          </motion.h1>
          <motion.div className="ml-auto flex space-x-2 md:space-x-4">
            <motion.button
              onClick={() => setIsScoreRubricOpen(true)}
              className="bg-white text-[#3CBFAE] px-2 md:px-3 py-1 rounded-full flex items-center space-x-1 hover:bg-opacity-90"
              whileHover={{ scale: 1.05 }}
            >
              <Users size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm hidden md:inline">Scoring</span>
            </motion.button>
            
            <motion.button
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-[#3CBFAE] px-2 md:px-3 py-1 rounded-full flex items-center space-x-1 hover:bg-opacity-90"
              whileHover={{ scale: 1.05 }}
            >
              <Settings size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm hidden md:inline">Instructions</span>
            </motion.button>
            
            <motion.button
              onClick={handleNewChat}
              className="bg-white text-[#3CBFAE] px-2 md:px-3 py-1 rounded-full flex items-center space-x-1 hover:bg-opacity-90"
              whileHover={{ scale: 1.05 }}
            >
              <Home size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm hidden md:inline">Home</span>
            </motion.button>
          </motion.div>
        </div>
      </motion.nav>
      
      <InstructionsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <ScoreRubricModal isOpen={isScoreRubricOpen} onClose={() => setIsScoreRubricOpen(false)} />
      
      <main className="absolute top-16 left-0 right-0 bottom-0 bg-gray-50">
        <section className="absolute top-0 left-0 right-0 bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-2 md:px-4 overflow-y-auto">
            {!isKeyValid ? (
              <motion.div 
                className="flex flex-col items-center justify-center h-full"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div 
                  className="bg-white p-4 md:p-6 rounded-xl shadow-lg w-full max-w-md mx-2"
                  whileHover={{ boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)" }}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="relative"
                  >
                    <div className="text-center text-gray-700">
                      <h3 className="text-xl font-semibold mb-2">API Key Validation</h3>
                      {isLoading ? (
                        <div className="flex flex-col items-center">
                          <p>Validating your API key...</p>
                          <div className="mt-4 flex items-center space-x-2">
                            <div className="w-3 h-3 bg-[#3CBFAE] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-3 h-3 bg-[#3CBFAE] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-3 h-3 bg-[#3CBFAE] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p>We need a valid OpenAI API key to continue.</p>
                          <div className="mt-4">
                            <input
                              type="password"
                              className="w-full p-2 border border-gray-300 rounded mb-2"
                              placeholder="Enter your OpenAI API key"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                            />
                            <button
                              onClick={() => validateApiKey(apiKey)}
                              className="bg-[#3CBFAE] text-white px-4 py-2 rounded-md hover:bg-[#35a99a] transition-colors w-full"
                            >
                              Validate Key
                            </button>
                          </div>
                        </>
                      )}
                      {error && <p className="text-red-500 mt-2">{error}</p>}
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            ) : (
              <div className="flex flex-col h-full">
                {isSessionActive ? (
                  showChatInterface ? (
                    <div className="flex-1 overflow-y-auto py-2 md:py-4">
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
                                    ? 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              {m.type === 'transcript' && (
                                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Transcript</div>
                              )}
                              <div className={`prose max-w-none prose-sm md:prose-base dark:prose-invert ${m.type === 'transcript' ? 'text-gray-800 dark:text-gray-300' : ''}`}>
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
                        
                        {/* Begin conversation button */}
                        {messages.length <= 1 && !hasStartedConversation && !isLoading && (
                          <motion.div 
                            className="flex justify-center my-4 md:my-8"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                          >
                            <motion.button
                              onClick={() => {
                                setHasStartedConversation(true);
                                sendTextMessage("begin");
                              }}
                              className="bg-gradient-to-r from-[#3CBFAE] to-[#35a99a] text-white px-4 md:px-8 py-3 md:py-4 rounded-lg font-medium text-base md:text-lg shadow-lg relative overflow-hidden"
                              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(60, 191, 174, 0.3)" }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {/* Animated background effect */}
                              <motion.div 
                                className="absolute inset-0 bg-white opacity-10"
                                animate={{
                                  x: ['-100%', '100%']
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "linear"
                                }}
                              />
                              
                              {/* Animated particles */}
                              {[...Array(5)].map((_, i) => (
                                <motion.div
                                  key={`particle-${i}`}
                                  className="absolute w-1 h-1 bg-white rounded-full"
                                  style={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                  }}
                                  animate={{
                                    y: [0, -10, 0],
                                    opacity: [0, 1, 0],
                                    scale: [0, 1.5, 0]
                                  }}
                                  transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    delay: i * 0.3,
                                    ease: "easeOut"
                                  }}
                                />
                              ))}
                              
                              <span className="relative z-10 flex items-center">
                                <span>Begin Conversation</span>
                                <motion.span
                                  animate={{ x: [0, 5, 0] }}
                                  transition={{ 
                                    duration: 1.5, 
                                    repeat: Infinity,
                                    repeatType: "reverse" 
                                  }}
                                  className="ml-2"
                                >
                                  →
                                </motion.span>
                              </span>
                            </motion.button>
                          </motion.div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                  ) : (
                    <VoiceAnimation 
                      onSwitchToChat={() => setShowChatInterface(true)}
                      stopSession={stopSession}
                      isRecording={isRecording}
                      startRecording={startRecording}
                      stopRecording={stopRecording}
                    />
                  )
                ) : (
                  <div className="w-full h-full">
                    <motion.div 
                      className="flex flex-col items-center justify-center h-full pt-0 md:pt-8 px-2 md:px-4 w-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <motion.h2 
                        className="text-xl md:text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-[#3CBFAE] to-[#D94B87] mb-6 md:mb-12 mt-0 md:mt-16 w-full"
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        Welcome to Pharmacy Benefits teach back
                      </motion.h2>
                      
                      <motion.div
                        className="relative mb-6 md:mb-12 w-full flex justify-center"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                      >
                        <div className="w-64 h-64 md:w-80 md:h-80 relative">
                          {/* Pulsing background */}
                          <motion.div 
                            className="absolute inset-0 bg-gradient-to-br from-[#3CBFAE]/10 to-[#D94B87]/10 rounded-xl md:rounded-2xl"
                            animate={{ 
                              boxShadow: ['0 0 0 rgba(60, 191, 174, 0.2)', '0 0 20px rgba(60, 191, 174, 0.4)', '0 0 0 rgba(60, 191, 174, 0.2)']
                            }}
                            transition={{ 
                              duration: 2.5,
                              repeat: Infinity,
                              repeatType: "reverse"
                            }}
                          />
                          
                          {/* Floating elements */}
                          {[...Array(5)].map((_, i) => (
                            <motion.div
                              key={i}
                              className={`absolute w-8 h-8 md:w-10 md:h-10 rounded-lg ${
                                i % 2 === 0 ? 'bg-[#3CBFAE]/20' : 'bg-[#D94B87]/20'
                              }`}
                              style={{
                                top: `${15 + (i * 15)}%`,
                                left: i % 2 === 0 ? '10%' : '75%',
                              }}
                              animate={{ 
                                y: [0, -10, 0],
                                rotate: [0, i % 2 === 0 ? 10 : -10, 0],
                                opacity: [0.7, 1, 0.7]
                              }}
                              transition={{ 
                                duration: 3,
                                delay: i * 0.3,
                                repeat: Infinity,
                                repeatType: "reverse"
                              }}
                            />
                          ))}
                          
                          {/* Central card */}
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                          >
                            <div className="bg-white rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6 w-56 md:w-64 flex flex-col items-center">
                              <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                              >
                                <Image 
                                  src="/Side-text.svg" 
                                  alt="Acolyte Health Logo" 
                                  width={120} 
                                  height={40}
                                  className="mb-3 md:mb-4 w-32 md:w-40"
                                />
                              </motion.div>
                              
                              <motion.p 
                                className="text-gray-600 text-center text-xs md:text-sm mb-3"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7, duration: 0.5 }}
                              >
                                Your AI-powered pharmacy benefits assistant
                              </motion.p>
                              
                              {/* Animated line */}
                              <motion.div 
                                className="h-0.5 bg-gradient-to-r from-[#3CBFAE] to-[#D94B87] w-0"
                                animate={{ width: "100%" }}
                                transition={{ delay: 0.9, duration: 0.8 }}
                              />
                              
                              {/* Animated icons with automatic animation */}
                              <motion.div 
                                className="flex justify-around w-full mt-3 md:mt-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.1, duration: 0.5 }}
                              >
                                <motion.div 
                                  animate={{ 
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, 0],
                                    y: [0, -3, 0]
                                  }}
                                  transition={{
                                    duration: 2,
                                    delay: 0,
                                    repeat: Infinity,
                                    repeatType: "reverse"
                                  }}
                                  className="text-[#3CBFAE]"
                                >
                                  <MessageCircle size={18} className="md:w-5 md:h-5" />
                                </motion.div>
                                <motion.div 
                                  animate={{ 
                                    scale: [1, 1.2, 1],
                                    rotate: [0, -10, 0],
                                    y: [0, -3, 0]
                                  }}
                                  transition={{
                                    duration: 2,
                                    delay: 0.7,
                                    repeat: Infinity,
                                    repeatType: "reverse"
                                  }}
                                  className="text-[#D94B87]"
                                >
                                  <FileText size={18} className="md:w-5 md:h-5" />
                                </motion.div>
                                <motion.div 
                                  animate={{ 
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, 0],
                                    y: [0, -3, 0]
                                  }}
                                  transition={{
                                    duration: 2,
                                    delay: 1.4,
                                    repeat: Infinity,
                                    repeatType: "reverse"
                                  }}
                                  className="text-[#3CBFAE]"
                                >
                                  <Users size={18} className="md:w-5 md:h-5" />
                                </motion.div>
                              </motion.div>
                              
                              {/* Add animated particles */}
                              {[...Array(8)].map((_, i) => (
                                <motion.div
                                  key={`particle-${i}`}
                                  className={`absolute w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${
                                    i % 2 === 0 ? 'bg-[#3CBFAE]/60' : 'bg-[#D94B87]/60'
                                  }`}
                                  style={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                  }}
                                  animate={{
                                    y: [0, -20, 0],
                                    x: [0, i % 2 === 0 ? 10 : -10, 0],
                                    opacity: [0, 1, 0],
                                    scale: [0, 1, 0]
                                  }}
                                  transition={{
                                    duration: 3 + (Math.random() * 2),
                                    repeat: Infinity,
                                    delay: i * 0.5,
                                    ease: "easeInOut"
                                  }}
                                />
                              ))}
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                      
                      <motion.div className="w-full flex justify-center">
                        <motion.button
                          onClick={startSession}
                          disabled={isLoading || !isKeyValid}
                          className="bg-[#3CBFAE] hover:bg-[#35a99a] text-white px-6 md:px-8 py-2 md:py-3 rounded-lg font-medium text-base md:text-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed w-44 md:w-56"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.7, duration: 0.5 }}
                        >
                          {isLoading ? (
                            <span className="flex items-center justify-center">
                              <Loader className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" />
                              Connecting...
                            </span>
                          ) : (
                            "Start Session"
                          )}
                        </motion.button>
                      </motion.div>
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </section>
          
          {/* Only render the bottom section when not showing voice animation */}
          {(isSessionActive && showChatInterface) && (
            <motion.section 
              className="absolute h-32 left-0 right-0 bottom-0 p-2 md:p-4 bg-white border-t border-gray-200"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {isSessionActive && showChatInterface ? (
                <form ref={formRef} onSubmit={handleSubmit} className="flex space-x-2 h-full items-center">
                  <textarea
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        formRef.current?.requestSubmit();
                      }
                    }}
                    placeholder="Type your message here..."
                    className="flex-1 p-2 md:p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBFAE] transition-all resize-none text-sm md:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    rows={2}
                  />
                  <div className="flex flex-col space-y-2">
                    {isVoiceQueryLoading && (
                      <div className="absolute right-12 md:right-16 bottom-16 bg-[#3CBFAE]/10 text-[#3CBFAE] px-2 py-1 rounded text-xs">
                        Fetching context...
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={!input.trim() || !isSessionActive || isVoiceQueryLoading}
                      className="p-2 bg-[#D94B87] text-white rounded-md hover:bg-[#C43A76] disabled:opacity-50"
                    >
                      <Send className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
                </form>
              ) : (
                <SessionControls
                  startSession={startSession}
                  stopSession={stopSession}
                  sendClientEvent={sendClientEvent}
                  sendTextMessage={sendTextMessage}
                  events={events}
                  isSessionActive={isSessionActive}
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  isKeyValid={isKeyValid}
                />
              )}
            </motion.section>
          )}
        </section>
      </main>
    </>
  );
}
