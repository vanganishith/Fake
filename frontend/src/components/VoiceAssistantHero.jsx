import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { submitVoiceFarmUpdate, sendVoiceConversation, synthesizeSpeech } from '../services/api';

export default function VoiceAssistantHero({
  farmer,
  onContextUpdated,
  activeCrop,
  cropAge
}) {
  const { currentLang } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastAck, setLastAck] = useState(null);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [progressivePrompt, setProgressivePrompt] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const recognitionRef = useRef(null);

  // Determine speech recognition language tag
  const getRecognitionLang = () => {
    if (currentLang === 'te') return 'te-IN';
    if (currentLang === 'hi') return 'hi-IN';
    if (currentLang === 'ta') return 'ta-IN';
    if (currentLang === 'kn') return 'kn-IN';
    return 'en-IN';
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getRecognitionLang();

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage(
          currentLang === 'te' ? 'వినబడుతోంది... మాట్లాడండి' :
          currentLang === 'hi' ? 'सुन रहा हूँ... बोलिए' :
          'Listening... Speak now'
        );
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setSpeechText(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('[WebSpeech Error]', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setStatusMessage(
            currentLang === 'te' ? 'మైక్రోఫోన్ అనుమతి అవసరం' : 'Microphone permission needed'
          );
        } else {
          setStatusMessage(
            currentLang === 'te' ? 'మీ మాట సరిగ్గా వినిపించలేదు. మళ్లీ చెప్పండి.' : 'Could not hear clearly. Please try again.'
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [currentLang]);

  const playVoiceAudio = async (text) => {
    if (!text) return;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getRecognitionLang();
        utterance.rate = 0.95;
        utterance.onstart = () => setIsPlayingAudio(true);
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
        return;
      } catch {}
    }
    try {
      setIsPlayingAudio(true);
      const res = await synthesizeSpeech({ text, language: currentLang || 'te' });
      if (res.audio_data) {
        const audio = new Audio(`data:${res.audio_mime || 'audio/wav'};base64,${res.audio_data}`);
        audio.onended = () => setIsPlayingAudio(false);
        audio.play();
      } else {
        setIsPlayingAudio(false);
      }
    } catch {
      setIsPlayingAudio(false);
    }
  };

  // When speechText finishes listening, process update or recommendation
  const handleProcessSpeech = async (textToProcess) => {
    const query = (textToProcess || speechText).trim();
    if (!query) return;

    setLoading(true);
    setAiRecommendation(null);
    setLastAck(null);
    setStatusMessage(
      currentLang === 'te' ? 'విశ్లేషిస్తున్నాము...' :
      currentLang === 'hi' ? 'समीक्षा हो रही है...' :
      'Analyzing farm context...'
    );

    try {
      // First check if this is an advisory question or follow-up
      const isQuestion = /ఎందుకు|ఎప్పుడు|ఎలా|నీళ్లు|నీరు|ఎరువు|మందు|ఆకులు|ఏం చేయాలి|చేయాలా|సమస్య|why|when|what|how|irrigate|water|fertilizer|spray|disease|pest|should i|kya karu|paani|kyu/i.test(query);

      if (isQuestion) {
        const res = await sendVoiceConversation({
          farmer_phone: farmer?.phone || '9876543210',
          query,
          language: currentLang || 'te',
        });

        if (res.success && res.recommendation) {
          setAiRecommendation(res.recommendation);
          setStatusMessage('');

          const speechToSay = res.recommendation.farmer_response || res.recommendation.summary;
          playVoiceAudio(speechToSay);

          if (onContextUpdated) onContextUpdated(res);
          return;
        }
      }

      // Default: Farm Memory & context update
      const res = await submitVoiceFarmUpdate({
        farmerPhone: farmer?.phone || '9876543210',
        textInput: query,
        language: currentLang || 'te',
      });

      if (res.success) {
        setLastAck(res.conversational_ack);
        setProgressivePrompt(res.progressive_prompt);
        setStatusMessage('');

        playVoiceAudio(res.conversational_ack);

        if (onContextUpdated) {
          onContextUpdated(res);
        }
      }
    } catch (err) {
      console.error('[VoiceHero Error]', err);
      setStatusMessage(
        currentLang === 'te' ? 'మీ మాట సరిగ్గా వినిపించలేదు. మళ్లీ చెప్పండి.' :
        'Could not complete request. Please try again.'
      );
    } finally {
      setLoading(false);
      setSpeechText('');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      if (speechText.trim()) {
        handleProcessSpeech(speechText);
      }
    } else {
      setSpeechText('');
      setLastAck(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.lang = getRecognitionLang();
          recognitionRef.current.start();
        } catch (e) {
          console.warn('Recognition start error:', e);
        }
      } else {
        // Fallback prompt for browsers without Web Speech
        const manual = window.prompt(
          currentLang === 'te' ? 'మీ వ్యవసాయ వివరాలు టైప్ చేయండి:' : 'Type your farm update:'
        );
        if (manual) handleProcessSpeech(manual);
      }
    }
  };

  // Quick chips for low-literacy farmers
  const quickChips = [
    {
      label: currentLang === 'te' ? '🌶️ నా 2 ఎకరాల్లో మిరప ఉంది' : '🌶️ 2 acres of Chilli',
      text: 'నా రెండు ఎకరాల్లో మిరప ఉంది'
    },
    {
      label: currentLang === 'te' ? '⏳ మిరప వేసి 48 రోజులు అయింది' : '⏳ Chilli is 48 days old',
      text: 'మిరప వేసి 48 రోజులు అయింది'
    },
    {
      label: currentLang === 'te' ? '💧 ఈ పొలానికి డ్రిప్ ఉంది' : '💧 Drip irrigation present',
      text: 'ఈ పొలానికి డ్రిప్ ఉంది'
    },
    {
      label: currentLang === 'te' ? '🌱 ఈ పొలం ఎర్ర నేల' : '🌱 Red soil in this field',
      text: 'ఈ పొలం ఎర్ర నేల'
    }
  ];

  return (
    <div
      className="voice-hero-card"
      data-testid="voice-assistant-hero"
      style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
        color: '#ffffff',
        borderRadius: '24px',
        padding: '24px 20px',
        boxShadow: '0 10px 30px rgba(6, 78, 59, 0.25)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '24px',
      }}
    >
      {/* Background Decorative Rings */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>👨‍🌾</span>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
              {farmer?.name || 'రైతు'} {farmer?.village ? `• 📍 ${farmer.village}` : ''}
            </h2>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
              {farmer?.phone ? `+91 ${farmer.phone.slice(-10)}` : 'ధృవీకరించబడిన ఖాతా'}
            </div>
          </div>
        </div>

        {activeCrop && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(8px)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            <span>{activeCrop === 'Chilli' ? '🌶️' : activeCrop === 'Paddy' ? '🌾' : activeCrop === 'Cotton' ? '🌿' : '🌱'}</span>
            <span>{activeCrop}</span>
            {cropAge !== null && cropAge !== undefined && (
              <span style={{ opacity: 0.9 }}>• {cropAge}d</span>
            )}
          </div>
        )}
      </div>

      {/* Main Voice Button Section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 0',
          textAlign: 'center',
        }}
      >
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          {isListening && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                left: '-12px',
                right: '-12px',
                bottom: '-12px',
                borderRadius: '50%',
                border: '3px solid rgba(134, 239, 172, 0.8)',
                animation: 'pulse 1.2s infinite ease-out',
              }}
            />
          )}
          <button
            type="button"
            onClick={toggleListening}
            data-testid="voice-hero-mic-btn"
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: isListening ? '#ef4444' : '#ffffff',
              color: isListening ? '#ffffff' : '#065f46',
              border: 'none',
              fontSize: '2.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isListening
                ? '0 0 25px rgba(239, 68, 68, 0.6)'
                : '0 8px 24px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span>{isListening ? '⏹️' : '🎤'}</span>
          </button>
        </div>

        <div style={{ fontWeight: '800', fontSize: '1.15rem', letterSpacing: '-0.01em', marginBottom: '4px' }}>
          {isListening
            ? (currentLang === 'te' ? 'మాట్లాడండి... పూర్తయ్యాక ట్యాప్ చేయండి' : 'Listening... Tap to finish')
            : (currentLang === 'te' ? 'కిసాన్‌సాథి తో మాట్లాడండి' : 'ASK KISAANSAATHI')}
        </div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, maxWidth: '320px', lineHeight: 1.4 }}>
          {currentLang === 'te'
            ? 'పంట, విస్తీర్ణం లేదా సమస్యను మీ సొంత గొంతుతో చెప్పండి.'
            : currentLang === 'hi'
            ? 'अपनी फसल, खेत या समस्या बोलकर बताएं।'
            : 'Say your crop, acreage, age or issue naturally.'}
        </div>

        {/* Live speech feedback */}
        {speechText && (
          <div
            style={{
              marginTop: '12px',
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '12px',
              padding: '8px 16px',
              fontSize: '0.925rem',
              fontWeight: '600',
              maxWidth: '90%',
            }}
          >
            &ldquo;{speechText}&rdquo;
          </div>
        )}

        {/* Status message / loader */}
        {(statusMessage || loading) && (
          <div
            style={{
              marginTop: '10px',
              fontSize: '0.825rem',
              color: '#86efac',
              fontWeight: '600',
            }}
          >
            {loading ? '⏳ ' : '🎙️ '} {statusMessage}
          </div>
        )}

        {/* Conversational acknowledgment */}
        {lastAck && !isListening && (
          <div
            style={{
              marginTop: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(134, 239, 172, 0.4)',
              borderRadius: '14px',
              padding: '10px 16px',
              fontSize: '0.9rem',
              fontWeight: '600',
              textAlign: 'left',
              width: '100%',
              maxWidth: '480px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#86efac', marginBottom: '2px' }}>
              <span>✅</span> <strong>{currentLang === 'te' ? 'వ్యవసాయ మెమరీ నవీకరించబడింది:' : 'Farm Memory Updated:'}</strong>
            </div>
            <div>{lastAck}</div>
            {progressivePrompt && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.2)', color: '#fef08a' }}>
                ❓ <strong>{progressivePrompt}</strong>
              </div>
            )}
          </div>
        )}

        {/* AI Farm Recommendation Display */}
        {aiRecommendation && !isListening && (
          <div
            style={{
              marginTop: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#0f172a',
              border: '2px solid #86efac',
              borderRadius: '16px',
              padding: '14px 18px',
              fontSize: '0.9rem',
              textAlign: 'left',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🤖</span>
                <span>{aiRecommendation.title || (currentLang === 'te' ? 'కిసాన్‌సాథి సలహా' : 'Farm AI Recommendation')}</span>
              </div>
              {aiRecommendation.priority && (
                <span
                  style={{
                    backgroundColor: aiRecommendation.priority === 'HIGH' ? '#fee2e2' : '#ecfdf5',
                    color: aiRecommendation.priority === 'HIGH' ? '#b91c1c' : '#047857',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                  }}
                >
                  {aiRecommendation.priority}
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.925rem', fontWeight: '700', color: '#1e293b', marginBottom: '6px', lineHeight: 1.4 }}>
              {aiRecommendation.farmer_response || aiRecommendation.summary}
            </div>

            {aiRecommendation.reasoning && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', marginBottom: '6px' }}>
                💡 {aiRecommendation.reasoning}
              </div>
            )}

            {aiRecommendation.actions && aiRecommendation.actions.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {aiRecommendation.actions.map((act, i) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      color: '#334155',
                      fontWeight: '600',
                    }}
                  >
                    ✓ {act}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Crop Gating Selector if inquiry misses crop */}
        {progressivePrompt && (
          <div
            style={{
              marginTop: '12px',
              backgroundColor: '#fef9c3',
              color: '#854d0e',
              border: '2px solid #facc15',
              borderRadius: '16px',
              padding: '14px',
              width: '100%',
              maxWidth: '520px',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>❓</span>
              <span>{currentLang === 'te' ? 'ఏ పంట గురించి అడుగుతున్నారు?' : 'Which crop are you asking about?'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { name: 'Chilli', icon: '🌶️', te: 'మిరప' },
                { name: 'Paddy', icon: '🌾', te: 'వరి' },
                { name: 'Cotton', icon: '🌿', te: 'పత్తి' },
                { name: 'Tomato', icon: '🍅', te: 'టమాటా' },
                { name: 'Maize', icon: '🌽', te: 'మొక్కజొన్న' },
                { name: 'Groundnut', icon: '🥜', te: 'వేరుశనగ' },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    const text = currentLang === 'te' ? `${c.te} పంట లో ${speechText}` : `${c.name} crop ${speechText}`;
                    setProgressivePrompt(null);
                    handleProcessSpeech(text);
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #facc15',
                    borderRadius: '12px',
                    padding: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: '#713f12',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{c.icon}</span> <span>{currentLang === 'te' ? c.te : c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TODAY'S 5-POINT FARM BRIEFING CARD */}
      <div
        className="today-briefing-card"
        style={{
          marginTop: '16px',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderRadius: '18px',
          padding: '16px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.3rem' }}>📅</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                {currentLang === 'te' ? 'ఈరోజు మీరు తెలుసుకోవలసిన విషయాలు' : "Today's Farm Briefing"}
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {currentLang === 'te' ? 'వాతావరణం, నీటి తడి, పంట ఆరోగ్యం & కమ్యూనిటీ' : 'Weather, Irrigation, Health & Alerts'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const summaryText = currentLang === 'te'
                ? `ఈరోజు వాతావరణం 32 డిగ్రీలు, ఎండగా ఉంది. రేపు వర్షం పడే అవకాశం ఉంది కాబట్టి ఈరోజు నీళ్లు పెట్టకండి. మీ మిరప పంట పూత దశలో ఉంది, ఆకుల అడుగున నల్లి పురుగులు ఉన్నాయా చూడండి. మీ గ్రామంలో 6 మంది రైతులు ఆకుముడుత సమస్య చెప్పారు.`
                : `Today is 32 degrees and sunny. Rain is expected tomorrow, so do not irrigate today. Your chilli crop is in flowering stage, inspect leaf undersides for thrips. 6 nearby farmers reported chilli curl symptoms.`;
              playVoiceAudio(summaryText);
            }}
            style={{
              backgroundColor: isPlayingAudio ? '#ef4444' : '#15803d',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
          >
            <span>{isPlayingAudio ? '⏹️' : '🔊'}</span>
            <span>{isPlayingAudio ? (currentLang === 'te' ? 'ఆపండి' : 'Stop') : (currentLang === 'te' ? 'వినండి' : "Listen to Today's Advice")}</span>
          </button>
        </div>

        {/* 5 Points Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '10px 12px', borderRadius: '12px', borderLeft: '4px solid #16a34a' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#166534' }}>☀️ {currentLang === 'te' ? 'వాతావరణం' : 'Weather'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>32°C • {currentLang === 'te' ? 'ఎండగా ఉంది (రేపు జల్లులు)' : 'Sunny (Light rain tomorrow)'}</div>
          </div>

          <div style={{ backgroundColor: '#eff6ff', padding: '10px 12px', borderRadius: '12px', borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0369a1' }}>💧 {currentLang === 'te' ? 'నీటి తడి సలహా' : 'Irrigation Advice'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{currentLang === 'te' ? 'ఈరోజు నీరు ఆపండి (రేపు వర్షం)' : 'Skip today (Rain forecast)'}</div>
          </div>

          <div style={{ backgroundColor: '#fefce8', padding: '10px 12px', borderRadius: '12px', borderLeft: '4px solid #ca8a04' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#854d0e' }}>🌿 {currentLang === 'te' ? 'పంట దశ & రక్షణ' : 'Crop Stage & Health'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{currentLang === 'te' ? 'పూత దశ (48వ రోజు) • నల్లి పురుగులు చూడండి' : 'Flowering (48d) • Inspect leaf underside'}</div>
          </div>

          <div style={{ backgroundColor: '#fdf2f8', padding: '10px 12px', borderRadius: '12px', borderLeft: '4px solid #db2777' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#9d174d' }}>📢 {currentLang === 'te' ? 'గ్రామ కమ్యూనిటీ హెచ్చరిక' : 'Community Signal'}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{currentLang === 'te' ? '6 పొలాల్లో ఆకు ముడుత కనిపించింది' : '6 nearby farms reported leaf curl'}</div>
          </div>
        </div>
      </div>

      {/* 1-Tap Quick Suggestion Chips */}
      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.15)', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {currentLang === 'te' ? 'తక్షణ ప్రశ్నలు & నమూనా మాటలు:' : 'Quick Farm Questions & Actions:'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            {
              label: currentLang === 'te' ? '💧 ఈరోజు నీళ్లు పెట్టాలా?' : '💧 Should I irrigate today?',
              text: 'నా పంటకు ఈరోజు నీళ్లు పెట్టాలా?'
            },
            {
              label: currentLang === 'te' ? '🧪 ఇప్పుడు ఎరువు వేయాలా?' : '🧪 Should I apply fertilizer?',
              text: 'ఇప్పుడు ఎరువు వేయాలా?'
            },
            {
              label: currentLang === 'te' ? '📋 ఈరోజు ఏం చేయాలి?' : '📋 What should I do today?',
              text: 'ఇప్పుడు నా పంటకు ఏం చేయాలి?'
            },
            {
              label: currentLang === 'te' ? '🌶️ 2 ఎకరాల్లో మిరప ఉంది' : '🌶️ 2 acres Chilli',
              text: 'నా రెండు ఎకరాల్లో మిరప ఉంది'
            }
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleProcessSpeech(chip.text)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                borderRadius: '16px',
                padding: '8px 14px',
                fontSize: '0.825rem',
                fontWeight: '700',
                cursor: 'pointer',
                minHeight: '44px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.22)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

