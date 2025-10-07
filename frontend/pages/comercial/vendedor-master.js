import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import SpaceLoader from '../../components/onety/menu/SpaceLoader';
import styles from '../../styles/comercial/crm/Realtime.module.css';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer } from '../../lib/wavtools/index.js';
import { instructions } from '../../utils/conversation_config.js';
import { WavRenderer } from '../../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../../components/comercial/realtime/button/Button';
import { Toggle } from '../../components/comercial/realtime/toggle/Toggle';
import SoundVisualizer from '../../components/comercial/realtime/SoundVisualizer';



// URL dedicada para WebSocket do Realtime; normaliza protocolo e caminho
const normalizeWsUrl = (rawUrl) => {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    if (u.protocol === 'http:') u.protocol = 'ws:';
    if (u.protocol === 'https:') u.protocol = 'wss:';
    if (!u.pathname || u.pathname === '/') u.pathname = '/ws';
    return u.toString();
  } catch (e) {
    // Se vier sem protocolo, tentar ws:// e ajustar
    try {
      const u2 = new URL(`ws://${rawUrl}`);
      if (!u2.pathname || u2.pathname === '/') u2.pathname = '/ws';
      return u2.toString();
    } catch {
      return rawUrl;
    }
  }
};

const WEBSOCKET_RELAY_URL = normalizeWsUrl(process.env.NEXT_PUBLIC_WS_URL);

export default function Console() {
  const router = useRouter();

  const apiKey = WEBSOCKET_RELAY_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  const wavRecorderRef = useRef(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef(
    new RealtimeClient(
      WEBSOCKET_RELAY_URL
        ? { url: WEBSOCKET_RELAY_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  const clientCanvasRef = useRef(null);
  const serverCanvasRef = useRef(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef(null);
  const startTimeRef = useRef(new Date().toISOString());

  const [items, setItems] = useState([]);
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  const formatTime = useCallback((timestamp) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    try {
      startTimeRef.current = new Date().toISOString();
      setError(null);
      setRealtimeEvents([]);
      setItems(client.conversation.getItems());

      await wavRecorder.begin();
      await wavStreamPlayer.connect();
      await client.connect();

      if (!client.isConnected()) {
        throw new Error('Falha ao conectar ao Realtime API');
      }

      setIsConnected(true);

      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello! The actual hour is ${updateCurrentTime()}`,
        },
      ]);

      if (client.getTurnDetectionType() === 'server_vad' && client.isConnected()) {
        await wavRecorder.record((data) => {
          if (client.isConnected()) client.appendInputAudio(data.mono);
        });
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erro ao conectar');
      setIsConnected(false);
      try { await wavRecorder.end(); } catch {}
      try { await wavStreamPlayer.interrupt(); } catch {}
      try { client.disconnect(); } catch {}
    }
  }, []);

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  const startRecording = async () => {
    const client = clientRef.current;
    if (!client.isConnected()) {
      setError('Não conectado ao Realtime API');
      return;
    }
    setIsRecording(true);
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => {
      if (client.isConnected()) client.appendInputAudio(data.mono);
    });
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  const changeTurnEndType = async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    client.updateSession({
      turn_detection: { type: 'server_vad' },
    });
    if (client.isConnected()) {
      await wavRecorder.record((data) => {
        if (client.isConnected()) client.appendInputAudio(data.mono);
      });
    }
  };

  useEffect(() => {
    changeTurnEndType();
  }, []);

  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    client.on('realtime.event', (realtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      client.reset();
    };
  }, []);

  const clientAnalyser = wavRecorderRef.current.analyser;
  const serverAnalyser = wavStreamPlayerRef.current.analyser;

  const updateCurrentTime = (() => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString());
    return now.toLocaleTimeString(); 
  });

  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
      <div className={styles.consolePage}>
        <div className={styles.contentTop}>
          {(clientAnalyser || serverAnalyser) && (
            <SoundVisualizer clientAnalyser={clientAnalyser} serverAnalyser={serverAnalyser} />
          )}
        </div>
        <div className={styles.contentMain}>
          <div className={styles.contentLogs}>
            <div className={`${styles.contentBlock} ${styles.events}`} style={{ display: 'none' }}>
              <div className={styles.visualization}>
                <div className={`${styles.visualizationEntry} ${styles.client}`}>
                  <canvas ref={clientCanvasRef} />
                </div>
                <div className={`${styles.visualizationEntry} ${styles.server}`}>
                  <canvas ref={serverCanvasRef} />
                </div>
              </div>
              <div className={styles.contentBlockTitle}>events</div>
              <div className={styles.contentBlockBody} ref={eventsScrollRef}>
                {!realtimeEvents.length && `awaiting connection...`}
                {realtimeEvents.map((realtimeEvent, i) => {
                  const count = realtimeEvent.count;
                  const event = { ...realtimeEvent.event };
                  if (event.type === 'input_audio_buffer.append') {
                    event.audio = `[trimmed: ${event.audio.length} bytes]`;
                  } else if (event.type === 'response.audio.delta') {
                    event.delta = `[trimmed: ${event.delta.length} bytes]`;
                  }
                  return (
                    <div className={styles.event} key={event.event_id}>
                      <div className={styles.eventTimestamp}>
                        {formatTime(realtimeEvent.time)}
                      </div>
                      <div className={styles.eventDetails}>
                        <div
                          className={styles.eventSummary}
                          onClick={() => {
                            const id = event.event_id;
                            const expanded = { ...expandedEvents };
                            if (expanded[id]) {
                              delete expanded[id];
                            } else {
                              expanded[id] = true;
                            }
                            setExpandedEvents(expanded);
                          }}
                        >
                          <div
                            className={`${styles.eventSource} ${
                              event.type === 'error'
                                ? styles.error
                                : styles[realtimeEvent.source]
                            }`}
                          >
                            {realtimeEvent.source === 'client' ? (
                              <ArrowUp />
                            ) : (
                              <ArrowDown />
                            )}
                            <span>
                              {event.type === 'error'
                                ? 'error!'
                                : realtimeEvent.source}
                            </span>
                          </div>
                          <div className={styles.eventType}>
                            {event.type}
                            {count && ` (${count})`}
                          </div>
                        </div>
                        {!!expandedEvents[event.event_id] && (
                          <div className={styles.eventPayload}>
                            {JSON.stringify(event, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              className={`${styles.contentBlock} ${styles.conversation}`}
              style={{ display: 'none' }}
            >
              <div className={styles.contentBlockTitle}>conversation</div>
              <div className={styles.contentBlockBody} data-conversation-content>
                {!items.length && `awaiting connection...`}
                {items.map((conversationItem, i) => {
                  return (
                    <div className={styles.conversationItem} key={conversationItem.id}>
                      <div className={`${styles.speaker} ${styles[conversationItem.role || '']}`}>
                        <div>
                          {(
                            conversationItem.role || conversationItem.type
                          ).replaceAll('_', ' ')}
                        </div>
                        <div
                          className={styles.close}
                          onClick={() =>
                            deleteConversationItem(conversationItem.id)
                          }
                        >
                          <X />
                        </div>
                      </div>
                      <div className={styles.speakerContent}>
                        {conversationItem.type === 'function_call_output' && (
                          <div>{conversationItem.formatted.output}</div>
                        )}
                        {!!conversationItem.formatted.tool && (
                          <div>
                            {conversationItem.formatted.tool.name}(
                            {conversationItem.formatted.tool.arguments})
                          </div>
                        )}
                        {!conversationItem.formatted.tool &&
                          conversationItem.role === 'user' && (
                            <div>
                              {conversationItem.formatted.transcript ||
                                (conversationItem.formatted.audio?.length
                                  ? '(awaiting transcript)'
                                  : conversationItem.formatted.text ||
                                    '(item sent)')}
                            </div>
                          )}
                        {!conversationItem.formatted.tool &&
                          conversationItem.role === 'assistant' && (
                            <div>
                              {conversationItem.formatted.transcript ||
                                conversationItem.formatted.text ||
                                '(truncated)'}
                            </div>
                          )}
                        {conversationItem.formatted.file && (
                          <audio
                            src={conversationItem.formatted.file.url}
                            controls
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.contentActions}>
              <Button
                label={isConnected ? 'Desconectar' : 'Conectar'}
                iconPosition={isConnected ? 'end' : 'start'}
                icon={isConnected ? X : Zap}
                buttonStyle={isConnected ? 'regular' : 'action'}
                onClick={isConnected ? disconnectConversation : connectConversation}
              />
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </>
  );
}

