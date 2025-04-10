'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '../page.module.css';

interface AgentChatProps {
  agentId: string;
  clientKey: string;
  voiceId?: string;
  onActivity?: () => void;
}

export default function AgentChat({ agentId, clientKey, voiceId, onActivity }: AgentChatProps) {
  // State variables
  const [connectionState, setConnectionState] = useState('Connecting..');
  const [messages, setMessages] = useState<Array<{ id?: string, role: string, content: string }>>([]);
  const [agentName, setAgentName] = useState('Your Agent');
  const [isReconnectVisible, setIsReconnectVisible] = useState(false);
  
  // Add new state for tracking last activity time
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a new state variable to track if the avatar is loaded
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  
  // Add a state to store starter messages
  const [starterMessages, setStarterMessages] = useState<string[]>([]);
  
  // Add state to track if starter messages should be shown
  const [showStarterMessages, setShowStarterMessages] = useState(true);
  
  // Add state to track if conversation has started
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // Add a new state to track loading state
  const [isLoading, setIsLoading] = useState(true);
  
  // Add state to track delayed avatar display
  const [showAvatar, setShowAvatar] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const answersRef = useRef<HTMLDivElement>(null);
  const srcObjectRef = useRef<MediaStream | null>(null);
  const agentManagerRef = useRef<any>(null);

  // Function to update last activity time
  const updateActivity = () => {
    setLastActivityTime(Date.now());
  };

  // Set up automatic reconnection timer
  useEffect(() => {
    // Check every 10 seconds if we need to reconnect
    const checkInactivity = () => {
      const currentTime = Date.now();
      const inactiveTime = currentTime - lastActivityTime;
      
      // If inactive for more than 1 minute (60000ms) and connected, reconnect
      if (inactiveTime > 60000 && connectionState === 'Online') {
        console.log("No activity for 1 minute, automatically reconnecting...");
        handleReconnect();
        // Reset the activity timer after reconnecting
        updateActivity();
      }
    };

    // Set up the timer
    reconnectTimerRef.current = setInterval(checkInactivity, 10000);
    
    // Clean up on unmount
    return () => {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
      }
    };
  }, [lastActivityTime, connectionState]);

  // Initialize the agent and speech recognition
  useEffect(() => {
    // This code only runs in the browser after component mount
    async function initializeAgent() {
      // Set loading to true when initialization starts
      setIsLoading(true);
      
      // Import the SDK dynamically to avoid SSR issues
      const { createAgentManager } = await import('@d-id/client-sdk');
      
      if (!agentId || !clientKey) {
        setConnectionState('Missing agentID and clientKey variables');
        console.error("Missing agentID and clientKey variables");
        return;
      }

      const auth = { 
        type: "key" as const, 
        clientKey
      };

      // Define SDK callbacks
      const callbacks = {
        onSrcObjectReady(value: MediaStream) {
          console.log("onSrcObjectReady():", value);
          if (videoRef.current) {
            videoRef.current.srcObject = value;
            srcObjectRef.current = value;
          }
          return srcObjectRef.current;
        },

        onConnectionStateChange(state: string) {
          console.log("onConnectionStateChange(): ", state);
          setConnectionState(state === 'connected' ? 'Online' : state);

          if (state === 'connecting') {
            setIsReconnectVisible(false);
            setAvatarLoaded(false); // Reset when reconnecting
            setShowAvatar(false); // Reset delayed avatar display
            setIsLoading(true); // Show loading spinner when connecting
          } else if (state === 'connected') {
            setIsReconnectVisible(false);
            setAvatarLoaded(true); // Set to true when connected
            
            // Delay hiding the loading spinner and showing the avatar
            setTimeout(() => {
              setIsLoading(false); // Hide loading spinner after delay
              setShowAvatar(true); // Show avatar after delay
            }); // 2 second delay instead of 3
          } else if (state === 'disconnected' || state === 'closed') {
            setIsReconnectVisible(true);
            setAvatarLoaded(false); // Reset when disconnected
            setShowAvatar(false); // Reset delayed avatar display
            setIsLoading(false); // Hide loading spinner when disconnected
          }
        },

        onVideoStateChange(state: string) {
          console.log("onVideoStateChange(): ", state);
          if (videoRef.current) {
            if (state === "STOP") {
              videoRef.current.muted = true;
              videoRef.current.srcObject = null;
              if (agentManagerRef.current?.agent?.presenter?.idle_video) {
                videoRef.current.src = agentManagerRef.current.agent.presenter.idle_video;
              }
            } else {
              videoRef.current.muted = false;
              videoRef.current.src = "";
              videoRef.current.srcObject = srcObjectRef.current ?? null;
              setConnectionState('Online');
            }
          }
        },

        onNewMessage(messages: any[], type: "user" | "answer" | "partial") {
          console.log("onNewMessage():", messages, type);
          setMessages(prevMessages => {
            // Add only new messages to avoid duplicates
            const newMessages = messages.filter(msg => 
              !prevMessages.some(prevMsg => prevMsg.id === msg.id)
            );
            
            // Log what's happening
            console.log("Previous messages:", prevMessages);
            console.log("New messages to add:", newMessages);
            
            return [...prevMessages, ...newMessages] as Array<{ id?: string, role: string, content: string }>;
          });
          
          // Auto-scroll to the last message
          if (answersRef.current) {
            setTimeout(() => {
              if (answersRef.current) {
                answersRef.current.scrollTop = answersRef.current.scrollHeight;
              }
            }, 100);
          }
        },

        onError(error: any, errorData: any) {
          setConnectionState('Something went wrong :(');
          console.log("Error:", error, "Error Data", errorData);
        }
      };

      // Stream options
      const streamOptions = { 
        compatibilityMode: "auto" as const, 
        streamWarmup: true,
        voice_id: voiceId
      };

      // Create the agent manager
      try {
        const manager = await createAgentManager(agentId, { auth, callbacks, streamOptions });
        console.log("createAgentManager()", manager);
        agentManagerRef.current = manager;

        // Set agent name and connect
        if (manager.agent?.preview_name) {
          setAgentName(manager.agent.preview_name);
        }

        // Extract starter messages if available
        if (manager.starterMessages && Array.isArray(manager.starterMessages)) {
          setStarterMessages(manager.starterMessages);
          console.log("Starter messages:", manager.starterMessages);
        }

        // Connect to the agent
        console.log("agentManager.connect()");
        manager.connect();
      } catch (error) {
        console.error("Failed to create agent manager:", error);
        setConnectionState(`Failed to create agent manager: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Only run in browser environment
    if (typeof window !== 'undefined') {
      initializeAgent();
    }

    // Cleanup on unmount
    return () => {
      if (agentManagerRef.current) {
        agentManagerRef.current.disconnect();
      }
    };
  }, [agentId, clientKey, voiceId]);

  // Update activity timestamp on user interactions
  const handleChat = () => {
    updateActivity();
    if (textAreaRef.current && textAreaRef.current.value !== '') {
      const val = textAreaRef.current.value;
      if (agentManagerRef.current) {
        agentManagerRef.current.chat(val);
        console.log("agentManager.chat()");
        setConnectionState('Thinking..');
        textAreaRef.current.value = '';
        // Mark conversation as started
        setConversationStarted(true);
      }
    }
    if (onActivity) {
      onActivity();
    }
  };

  const handleSpeak = () => {
    updateActivity();
    if (textAreaRef.current && textAreaRef.current.value !== '' && textAreaRef.current.value.length > 2) {
      const val = textAreaRef.current.value;
      if (agentManagerRef.current) {
        agentManagerRef.current.speak({
          type: "text",
          input: val,
          voice_id: "your-voice-id-here"
        });
        console.log(`agentManager.speak("${val}")`);
        setConnectionState('Streaming..');
      }
    }
    if (onActivity) {
      onActivity();
    }
  };

  const handleRate = (messageId: string, score: number) => {
    updateActivity();
    if (agentManagerRef.current) {
      const result = agentManagerRef.current.rate(messageId, score);
      console.log(`Message ID: ${messageId} Rated:${score}\n`, "Result", result);
    }
    if (onActivity) {
      onActivity();
    }
  };

  const handleReconnect = () => {
    updateActivity();
    if (agentManagerRef.current) {
      console.log("agentManager.reconnect()");
      agentManagerRef.current.reconnect();
    }
    if (onActivity) {
      onActivity();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    updateActivity();
    if (e.key === 'Enter' && connectionState === 'Online') {
      e.preventDefault();
      handleChat();
    }
  };

  // Add event handlers to track user activity
  useEffect(() => {
    const handleUserActivity = () => {
      updateActivity();
    };

    // Track various user activities
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keypress', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keypress', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
    };
  }, []);

  // Add a function to handle starter message selection
  const handleStarterMessage = (message: string) => {
    updateActivity();
    if (agentManagerRef.current) {
      agentManagerRef.current.chat(message);
      console.log(`agentManager.chat("${message}")`);
      setConnectionState('Thinking..');
      // Hide starter messages after one is clicked
      setShowStarterMessages(false);
      // Mark conversation as started
      setConversationStarted(true);
    }
    if (onActivity) {
      onActivity();
    }
  };

  // Add useEffect to display starter messages in conversation area
  useEffect(() => {
    // Only add starter messages to conversation if there are no messages yet
    if (messages.length === 0 && starterMessages.length > 0 && avatarLoaded) {
      console.log("Displaying starter messages:", starterMessages);
      
      // Create a welcome message from the agent
      const welcomeMessage = {
        role: 'assistant',
        content: 'Hello! I can help you with the following:',
      };
      
      // Set just the welcome message
      setMessages([welcomeMessage]);
    }
  }, [starterMessages, avatarLoaded, messages.length]);

  // Add a debug effect to monitor messages state
  useEffect(() => {
    console.log("Current messages state:", messages);
  }, [messages]);

  // Debug effect to monitor starterMessages
  useEffect(() => {
    console.log("Current starterMessages:", starterMessages);
  }, [starterMessages]);

  // Add useEffect to reset showStarterMessages when messages are reset
  useEffect(() => {
    if (messages.length === 0) {
      setShowStarterMessages(true);
    }
  }, [messages.length]);

  // Add this function to handle textarea changes
  const handleTextAreaChange = () => {
    // Hide starter messages when user starts typing
    if (showStarterMessages) {
      setShowStarterMessages(false);
    }
    updateActivity();
  };

  return (
    <>
      {!isReconnectVisible ? (
        <div id="container" className={styles.fullscreenContainer}>
          {/* Video as full background */}
          <video 
            id="videoElement" 
            ref={videoRef} 
            className={`${styles.fullscreenVideo} ${showAvatar ? '' : styles.hiddenVideo}`} 
            autoPlay 
            loop
            playsInline
            onCanPlay={() => {
              console.log("Video can play, setting avatarLoaded to true");
              setAvatarLoaded(true);
            }}
          />
          
          {/* Enhanced loading spinner - show when isLoading is true */}
          {isLoading && (
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
              <div className={styles.loadingText}>Loading {agentName}...</div>
            </div>
          )}
          
          {/* Agent info (name and status) - only show when avatar is shown */}
          {showAvatar && (
            <div className={styles.agentInfo}>
              <span id="previewName" className={styles.previewName}>{agentName}</span>
              <span id="connectionLabel" className={styles.connectionLabel}>{connectionState}</span>
            </div>
          )}
          
          {/* Messages overlay - only show when avatar is shown */}
          {showAvatar && (
            <div 
              ref={answersRef} 
              className={`${styles.messagesOverlay} ${!conversationStarted ? styles.messagesOverlayTop : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Regular messages */}
              {messages.map((msg: any, index) => (
                <div 
                  key={msg.id || index} 
                  className={`${styles.message} ${styles[msg.role]}`}
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white' }}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          )}
          
          {/* Bottom controls - action buttons and input - only show when avatar is shown */}
          <div className={`${styles.bottomControls} ${!showAvatar ? styles.bottomControlsHidden : ''}`}>
            {/* Starter questions above text area - only show if showStarterMessages is true */}
            {showAvatar && starterMessages.length > 0 && showStarterMessages && (
              <div className={styles.starterQuestionsContainer}>
                {starterMessages.map((msg, index) => (
                  <div 
                    key={index}
                    className={styles.starterQuestion}
                    onClick={() => handleStarterMessage(msg)}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            )}
            
            <div className={styles.inputContainer}>
              <textarea 
                id="textArea" 
                ref={textAreaRef} 
                placeholder="Type here..." 
                autoFocus
                onKeyPress={handleKeyPress}
                onChange={handleTextAreaChange}
                className={styles.chatInput}
              />
              <button 
                className={styles.sendButton}
                onClick={handleChat} 
                disabled={connectionState !== 'Online'}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className={styles.micIcon}>
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div id="hidden" className={styles.hidden}>
          <h2>{agentName} Disconnected</h2>
          <button 
            id="reconnectButton" 
            onClick={handleReconnect}
            title="agentManager.reconnect() -> Reconnects the previous WebRTC session"
          >
            Reconnect
          </button>
        </div>
      )}
    </>
  );
}