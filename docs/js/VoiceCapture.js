/**
 * VoiceCapture - Voice recording and transcription
 * Handles voice capture button, recording, and Whisper transcription
 * Dependencies: AppState, GitHubAPI, QueueManager, UI (toast, pollForCaptureResult)
 */
class VoiceCapture {
    static mediaRecorder = null;
    static recordingStream = null;
    static audioChunks = [];
    static isRecording = false;
    static isTranscribing = false;
    static transcriberPromise = null;

    /**
     * Setup capture buttons and event listeners
     */
    static setupCapture() {
        const captureBtn = document.getElementById('captureBtn');
        const captureInput = document.getElementById('captureInput');
        const holdToTalkBtn = document.getElementById('holdToTalkBtn');

        // Setup voice button
        this.setupVoiceButton(holdToTalkBtn, captureInput);

        // Setup text capture button
        this.setupTextCaptureButton(captureBtn, captureInput);

        // Submit on Ctrl+Enter
        captureInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                captureBtn.click();
            }
        });
    }

    /**
     * Setup voice recording button
     * @param {HTMLElement} holdToTalkBtn - Voice button element
     * @param {HTMLElement} captureInput - Capture input element
     */
    static setupVoiceButton(holdToTalkBtn, captureInput) {
        if (!holdToTalkBtn) return;

        const supportsVoiceCapture = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

        if (!supportsVoiceCapture) {
            holdToTalkBtn.disabled = true;
            holdToTalkBtn.title = 'Voice capture not supported in this browser.';
            return;
        }

        this.setHoldButtonState(holdToTalkBtn, 'idle');

        holdToTalkBtn.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            if (event.pointerId) {
                holdToTalkBtn.setPointerCapture?.(event.pointerId);
            }
            this.startRecording(holdToTalkBtn, captureInput);
        });

        holdToTalkBtn.addEventListener('pointerup', (event) => {
            event.preventDefault();
            this.stopRecording(holdToTalkBtn);
        });

        holdToTalkBtn.addEventListener('pointerleave', (event) => {
            event.preventDefault();
            this.stopRecording(holdToTalkBtn);
        });

        holdToTalkBtn.addEventListener('pointercancel', (event) => {
            event.preventDefault();
            this.stopRecording(holdToTalkBtn);
        });

        holdToTalkBtn.addEventListener('keydown', (event) => {
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                this.startRecording(holdToTalkBtn, captureInput);
            }
        });

        holdToTalkBtn.addEventListener('keyup', (event) => {
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                this.stopRecording(holdToTalkBtn);
            }
        });
    }

    /**
     * Setup text capture button
     * @param {HTMLElement} captureBtn - Capture button element
     * @param {HTMLElement} captureInput - Capture input element
     */
    static setupTextCaptureButton(captureBtn, captureInput) {
        captureBtn.addEventListener('click', async () => {
            const text = captureInput.value.trim();
            if (!text) return;

            captureBtn.disabled = true;
            captureBtn.innerHTML = '<span class="spinner"></span> Capturing...';

            // Hide result from previous capture
            const resultDiv = document.getElementById('captureResult');
            resultDiv?.classList.add('hidden');

            try {
                const lines = text.split('\n');
                const title = lines[0].trim().slice(0, 80) || 'Capture';
                const body = lines.slice(1).join('\n').trim() || text;

                if (AppState.isOnline && AppState.token) {
                    // Use issuesRepo for creating issues (M2B), not the data repo (M2B-Data)
                    const issuesApi = new GitHubAPI(AppState.token, AppState.issuesRepo);
                    const issue = await issuesApi.createIssue(title, body);
                    if (window.UI && UI.showToast) {
                        UI.showToast('Captured! Processing...', 'success');
                    }

                    // Clear input immediately
                    captureInput.value = '';

                    // Poll for result
                    if (window.UI && UI.pollForCaptureResult) {
                        UI.pollForCaptureResult(issuesApi, issue.number, resultDiv);
                    }
                } else {
                    await QueueManager.enqueue({
                        type: 'capture',
                        data: { title, body },
                        description: text.substring(0, 50) + '...'
                    });
                    if (window.UI && UI.showToast) {
                        UI.showToast('Queued for sync', 'info');
                    }
                    captureInput.value = '';
                }
            } catch (error) {
                if (window.UI && UI.showToast) {
                    UI.showToast('Capture failed: ' + error.message, 'error');
                }
            } finally {
                captureBtn.disabled = false;
                captureBtn.innerHTML = `
                    <span class="btn-icon">
                        <svg class="icon icon-inbox" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                        </svg>
                    </span>
                    Capture
                `;
            }
        });
    }

    /**
     * Start audio recording
     * @param {HTMLElement} holdToTalkBtn - Voice button element
     * @param {HTMLElement} captureInput - Capture input element
     */
    static async startRecording(holdToTalkBtn, captureInput) {
        if (this.isRecording || this.isTranscribing) return;

        try {
            this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(this.recordingStream);

            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            });

            this.mediaRecorder.addEventListener('stop', async () => {
                const blob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
                this.stopStream();
                await this.transcribeAudioBlob(blob, holdToTalkBtn, captureInput);
            });

            this.mediaRecorder.start();
            this.isRecording = true;
            this.setHoldButtonState(holdToTalkBtn, 'recording');
        } catch (error) {
            this.stopStream();
            this.isRecording = false;
            this.setHoldButtonState(holdToTalkBtn, 'idle');
            if (window.UI && UI.showToast) {
                UI.showToast(`Microphone error: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Stop audio recording
     * @param {HTMLElement} holdToTalkBtn - Voice button element
     */
    static stopRecording(holdToTalkBtn) {
        if (!this.isRecording) return;
        this.isRecording = false;

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            return;
        }

        this.stopStream();
        this.setHoldButtonState(holdToTalkBtn, 'idle');
    }

    /**
     * Stop media stream
     */
    static stopStream() {
        if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => track.stop());
            this.recordingStream = null;
        }
    }

    /**
     * Transcribe audio blob using Whisper
     * @param {Blob} blob - Audio blob
     * @param {HTMLElement} holdToTalkBtn - Voice button element
     * @param {HTMLElement} captureInput - Capture input element
     */
    static async transcribeAudioBlob(blob, holdToTalkBtn, captureInput) {
        if (!blob || blob.size === 0) {
            if (window.UI && UI.showToast) {
                UI.showToast('No audio captured', 'info');
            }
            return;
        }

        this.isTranscribing = true;
        this.setHoldButtonState(holdToTalkBtn, 'transcribing');

        try {
            const transcriber = await this.getTranscriber();
            const audioUrl = URL.createObjectURL(blob);
            const result = await transcriber(audioUrl);
            URL.revokeObjectURL(audioUrl);

            const transcript = result?.text || '';
            if (!transcript.trim()) {
                if (window.UI && UI.showToast) {
                    UI.showToast('No speech detected', 'info');
                }
                return;
            }

            this.appendTranscript(captureInput, transcript);
            if (window.UI && UI.showToast) {
                UI.showToast('Voice note transcribed', 'success');
            }
        } catch (error) {
            this.transcriberPromise = null;
            if (window.UI && UI.showToast) {
                UI.showToast(`Transcription failed: ${error.message}`, 'error');
            }
        } finally {
            this.isTranscribing = false;
            this.setHoldButtonState(holdToTalkBtn, 'idle');
        }
    }

    /**
     * Load Transformers.js library
     * @returns {Promise<object>} Transformers module
     */
    static async loadTransformers() {
        if (window.transformers?.pipeline) {
            return window.transformers;
        }
        try {
            const module = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
            return module;
        } catch (error) {
            throw new Error('Failed to load speech transcription library.');
        }
    }

    /**
     * Get or create transcriber instance
     * @returns {Promise<object>} Transcriber pipeline
     */
    static async getTranscriber() {
        if (this.transcriberPromise) {
            return this.transcriberPromise;
        }

        this.transcriberPromise = (async () => {
            const { pipeline, env } = await this.loadTransformers();
            env.allowLocalModels = false;
            env.useBrowserCache = true;
            env.logLevel = 'fatal'; // Suppress ONNX Runtime warnings
            return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
        })();

        return this.transcriberPromise;
    }

    /**
     * Append transcript to capture input
     * @param {HTMLElement} captureInput - Capture input element
     * @param {string} transcript - Transcribed text
     */
    static appendTranscript(captureInput, transcript) {
        if (!transcript) return;
        const trimmed = transcript.trim();
        if (!trimmed) return;

        captureInput.value = captureInput.value.trim()
            ? `${captureInput.value.trim()}\n${trimmed}`
            : trimmed;
        captureInput.focus();
    }

    /**
     * Set hold button visual state
     * @param {HTMLElement} holdToTalkBtn - Voice button element
     * @param {string} state - State: 'idle', 'recording', 'transcribing'
     */
    static setHoldButtonState(holdToTalkBtn, state) {
        if (!holdToTalkBtn) return;

        const holdIconMarkup = `
            <svg class="icon icon-mic" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
        `;

        const buildMarkup = (label, showSpinner = false) => `
            <span class="btn-icon">${showSpinner ? '<span class="spinner"></span>' : holdIconMarkup}</span>
            ${label}
        `;

        if (state === 'recording') {
            holdToTalkBtn.classList.add('recording');
            holdToTalkBtn.disabled = false;
            holdToTalkBtn.setAttribute('aria-pressed', 'true');
            holdToTalkBtn.innerHTML = buildMarkup('Release to transcribe');
        } else if (state === 'transcribing') {
            holdToTalkBtn.classList.remove('recording');
            holdToTalkBtn.disabled = true;
            holdToTalkBtn.setAttribute('aria-pressed', 'false');
            holdToTalkBtn.innerHTML = buildMarkup('Transcribing...', true);
        } else {
            holdToTalkBtn.classList.remove('recording');
            holdToTalkBtn.disabled = false;
            holdToTalkBtn.setAttribute('aria-pressed', 'false');
            holdToTalkBtn.innerHTML = buildMarkup('Hold to talk');
        }
    }
}

// Expose globally
window.VoiceCapture = VoiceCapture;
