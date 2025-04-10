'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Mic, Square } from 'lucide-react';

interface VoiceAnimationProps {
  onSwitchToChat: () => void;
  stopSession: () => void;
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  onError?: () => void;
}

const VoiceAnimation: React.FC<VoiceAnimationProps> = ({
  onSwitchToChat,
  stopSession,
  isRecording,
  startRecording,
  stopRecording,
  onError
}) => {
  // Use a ref to track animation frame
  const animationFrameRef = useRef<number | null>(null);
  // Track time for continuous animation
  const timeRef = useRef<number>(0);
  // State for wave points - INCREASED TO 120 POINTS FOR WIDER WAVE
  const [wavePoints, setWavePoints] = useState<number[]>(Array(120).fill(0.5));
  
  // Continuous wave animation
  useEffect(() => {
    const animateWave = () => {
      timeRef.current += 0.05;
      
      // Generate smooth wave points
      const newPoints = Array(120).fill(0).map((_, i) => {
        // Base sine wave with increased amplitude for taller waves
        const baseWave = Math.sin(timeRef.current + i * 0.15) * 0.7 + 0.5;
        
        // Add secondary wave for complexity
        const secondaryWave = Math.sin(timeRef.current * 0.5 + i * 0.2) * 0.3;
        
        // Add tertiary wave for more detail
        const tertiaryWave = Math.sin(timeRef.current * 1.3 + i * 0.1) * 0.15;
        
        // Add randomness when recording
        const randomness = isRecording ? (Math.random() * 0.2 - 0.1) : 0;
        
        // Combine waves and clamp between 0.05 and 0.95 for more extreme values
        return Math.max(0.05, Math.min(0.95, baseWave + secondaryWave + tertiaryWave + randomness));
      });
      
      setWavePoints(newPoints);
      animationFrameRef.current = requestAnimationFrame(animateWave);
    };
    
    animateWave();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording]);

  const handleSwitchToChat = () => {
    try {
      // Switch to chat interface
      onSwitchToChat();
      
      // End the current realtime session if active
      if (typeof stopSession === 'function') {
        try {
          stopSession();
        } catch (error) {
          console.error("Error stopping session:", error);
        }
      }
    } catch (error) {
      console.error("Error switching to chat:", error);
      // Call onError if provided
      if (onError) {
        onError();
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Main speaker button with gradient background */}
      <motion.div 
        className="relative mb-8 mt-8"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-72 h-72 relative">
          {/* Gradient background circle with animation */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-[#3CBFAE]/20 to-[#D94B87]/20 rounded-full"
            animate={{
              background: isRecording 
                ? [
                    'linear-gradient(to right, rgba(60, 191, 174, 0.2), rgba(217, 75, 135, 0.2))',
                    'linear-gradient(to right, rgba(60, 191, 174, 0.3), rgba(217, 75, 135, 0.3))',
                    'linear-gradient(to right, rgba(60, 191, 174, 0.2), rgba(217, 75, 135, 0.2))'
                  ]
                : []
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />
          
          {/* Enhanced pulsing rings for recording state */}
          {isRecording && (
            <>
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-red-500/30"
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.3, 0.7, 0.3]
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-red-500/20"
                animate={{ 
                  scale: [1, 1.25, 1],
                  opacity: [0.2, 0.5, 0.2]
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.3
                }}
              />
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-red-500/10"
                animate={{ 
                  scale: [1, 1.35, 1],
                  opacity: [0.1, 0.3, 0.1]
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.6
                }}
              />
            </>
          )}
          
          {/* Enhanced pulsing rings for non-recording state */}
          {!isRecording && (
            <>
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-[#3CBFAE]/30"
                animate={{ 
                  scale: [1, 1.08, 1],
                  opacity: [0.2, 0.5, 0.2]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-[#D94B87]/20"
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.1, 0.4, 0.1]
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.7
                }}
              />
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-[#3CBFAE]/10"
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.05, 0.25, 0.05]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.4
                }}
              />
            </>
          )}
          
          {/* Enhanced center button with more dynamic animation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className={`w-36 h-36 bg-white rounded-full shadow-lg flex items-center justify-center ${
                isRecording ? 'ring-2 ring-red-500 ring-opacity-50' : ''
              }`}
              animate={isRecording ? {
                boxShadow: [
                  '0 4px 6px rgba(0, 0, 0, 0.1)',
                  '0 12px 20px rgba(239, 68, 68, 0.4)',
                  '0 4px 6px rgba(0, 0, 0, 0.1)'
                ],
                scale: [1, 1.03, 1]
              } : {
                boxShadow: [
                  '0 4px 6px rgba(0, 0, 0, 0.1)',
                  '0 8px 15px rgba(60, 191, 174, 0.2)',
                  '0 4px 6px rgba(0, 0, 0, 0.1)'
                ],
                scale: [1, 1.02, 1]
              }}
              transition={{
                duration: isRecording ? 1.2 : 2.5,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className="w-full h-full rounded-full flex items-center justify-center focus:outline-none"
              >
                {isRecording ? (
                  <motion.div
                    animate={{ 
                      scale: [1, 1.15, 1],
                      opacity: [0.8, 1, 0.8],
                      rotate: [0, 5, 0, -5, 0]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    <Square className="w-14 h-14 text-red-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ 
                      scale: [1, 1.08, 1],
                      opacity: [0.9, 1, 0.9],
                      y: [0, -2, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    <Mic className="w-14 h-14 text-[#3CBFAE]" />
                  </motion.div>
                )}
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>
      
      {/* Waveform visualization below the speaker - WIDER CONTINUOUS WAVE */}
      <motion.div
        className="w-full mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ maxWidth: "600px" }} // INCREASED WIDTH FROM 400px to 600px
      >
        <div className="flex items-center justify-center">
          <div className="flex items-center" style={{ gap: 0 }}>
            {wavePoints.map((point, i) => (
              <div 
                key={`wave-${i}`} 
                className="flex flex-col items-center" 
                style={{ width: '2px', padding: 0, margin: 0 }} // Fixed width with no spacing
              >
                {/* Dot matrix for the waveform - ABSOLUTELY NO SPACE BETWEEN COLUMNS */}
                {[...Array(10)].map((_, j) => {
                  const rowPosition = j / 9; // 0 to 1
                  const distanceFromMiddle = Math.abs(rowPosition - 0.5) * 2; // 0 to 1, where 0 is middle
                  const threshold = point;
                  const isActive = distanceFromMiddle < threshold;
                  
                  return (
                    <div
                      key={`wave-dot-${i}-${j}`}
                      className={`rounded-full ${
                        isActive 
                          ? isRecording 
                            ? 'bg-red-500' 
                            : 'bg-[#3CBFAE]'
                          : 'bg-transparent'
                      }`}
                      style={{
                        width: '2px',
                        height: '2px',
                        margin: '0.5px 0',
                        padding: 0,
                        opacity: isActive ? 0.7 + (1 - distanceFromMiddle / threshold) * 0.3 : 0
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      
      {/* Status text with enhanced animation */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.h2 
          className={`text-2xl font-bold mb-2 ${isRecording ? 'text-red-500' : 'text-gray-800'}`}
          animate={isRecording ? {
            scale: [1, 1.05, 1],
            textShadow: [
              '0 0 0px rgba(239, 68, 68, 0)',
              '0 0 5px rgba(239, 68, 68, 0.3)',
              '0 0 0px rgba(239, 68, 68, 0)'
            ]
          } : {}}
          transition={{
            duration: 1.5,
            repeat: isRecording ? Infinity : 0,
            repeatType: "reverse"
          }}
        >
          {isRecording ? "Listening..." : "Tap to speak"}
        </motion.h2>
        <p className="text-gray-600">
          Ask me anything about pharmacy benefits
        </p>
      </motion.div>
      
      {/* Action buttons */}
      <motion.div
        className="flex space-x-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          className="bg-[#3CBFAE] text-white px-6 py-3 rounded-lg font-medium text-lg shadow-md flex items-center space-x-2"
          onClick={handleSwitchToChat}
          whileHover={{ scale: 1.05, boxShadow: '0 10px 15px rgba(60, 191, 174, 0.2)' }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageCircle size={20} />
          <span>Switch to Chat</span>
        </motion.button>
        
        <motion.button
          className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium text-lg shadow-md"
          onClick={stopSession}
          whileHover={{ scale: 1.05, boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)' }}
          whileTap={{ scale: 0.95 }}
        >
          <span>End Session</span>
        </motion.button>
      </motion.div>
    </div>
  );
};

export default VoiceAnimation; 