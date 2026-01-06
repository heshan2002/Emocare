import cv2
import numpy as np
import time
import threading
import queue
import librosa
import pyaudio
import wave
from collections import Counter
from tensorflow.keras.models import load_model

# ================= CONFIG =================
FACE_MODEL_PATH = "face/fer_baseline.h5"
VOICE_MODEL_PATH = "voice/voice_cnn_best.h5"
VOICE_LABELS_PATH = "voice/voice_labels.npy"

CAMERA_INDEX = 0
RECORD_SECONDS = 3
VOICE_HOLD_TIME = 10        # seconds
FACE_BUFFER_SIZE = 5        # 5 frames smoothing
FINAL_WINDOW_TIME = 8       # seconds
FINAL_LOCK_TIME = 5         # seconds

# =========================================

face_model = load_model(FACE_MODEL_PATH)
voice_model = load_model(VOICE_MODEL_PATH)
voice_labels = np.load(VOICE_LABELS_PATH)

FACE_LABELS = ['Angry','Disgust','Fear','Happy','Sad','Surprise','Neutral']

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# ----------- VOICE THREAD -----------------
class VoiceThread(threading.Thread):
    def __init__(self, out_q):
        super().__init__(daemon=True)
        self.q = out_q

    def run(self):
        p = pyaudio.PyAudio()

        while True:
            frames = []
            stream = p.open(format=pyaudio.paInt16,
                            channels=1,
                            rate=44100,
                            input=True,
                            frames_per_buffer=1024)

            for _ in range(int(44100 / 1024 * RECORD_SECONDS)):
                frames.append(stream.read(1024, exception_on_overflow=False))

            stream.stop_stream()
            stream.close()

            wf = wave.open("temp.wav", 'wb')
            wf.setnchannels(1)
            wf.setsampwidth(p.get_sample_size(pyaudio.paInt16))
            wf.setframerate(44100)
            wf.writeframes(b''.join(frames))
            wf.close()

            try:
                audio, sr = librosa.load("temp.wav", duration=3)
                mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40)
                feat = np.mean(mfcc.T, axis=0).reshape(1, 40, 1, 1)

                pred = voice_model.predict(feat, verbose=0)
                label = voice_labels[np.argmax(pred)]
                conf = np.max(pred)

                # Confidence threshold
                if conf > 0.40:
                    self.q.put((label, conf, time.time()))

            except:
                pass

# ----------- FUSION (FACE PRIORITY) -----------------
def intelligent_fusion(face, voice):
    if face != "Neutral":
        return face
    return voice.capitalize() if voice != "neutral" else face

# =========================================

def main():
    cap = cv2.VideoCapture(CAMERA_INDEX)
    voice_q = queue.Queue()
    VoiceThread(voice_q).start()

    face_buffer = []
    final_buffer = []

    last_voice = None
    last_voice_time = 0

    final_lock_emotion = None
    final_lock_time = 0

    print("Press Q to quit")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.resize(frame, (640, 480))
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        face_emotion = "Neutral"

        if len(faces) > 0:
            x, y, w, h = faces[0]
            roi = gray[y:y+h, x:x+w]
            roi = cv2.resize(roi, (48, 48)) / 255.0
            roi = roi.reshape(1, 48, 48, 1)

            pred = face_model.predict(roi, verbose=0)
            face_emotion = FACE_LABELS[np.argmax(pred)]

            face_buffer.append(face_emotion)
            if len(face_buffer) > FACE_BUFFER_SIZE:
                face_buffer.pop(0)

            face_emotion = Counter(face_buffer).most_common(1)[0][0]
            cv2.rectangle(frame, (x,y), (x+w,y+h), (0,255,0), 2)

        # -------- VOICE MEMORY --------
        while not voice_q.empty():
            last_voice, _, last_voice_time = voice_q.get()

        if last_voice and time.time() - last_voice_time > VOICE_HOLD_TIME:
            last_voice = None

        voice_display = last_voice if last_voice else "N/A"

        # -------- FINAL STABILIZATION --------
        raw_final = intelligent_fusion(
            face_emotion,
            last_voice.lower() if last_voice else "neutral"
        )

        now = time.time()
        final_buffer.append((raw_final, now))
        final_buffer = [(e,t) for e,t in final_buffer if now - t <= FINAL_WINDOW_TIME]

        if final_lock_emotion and now - final_lock_time < FINAL_LOCK_TIME:
            stable_final = final_lock_emotion
        else:
            emotions = [e for e,_ in final_buffer]
            stable_final = Counter(emotions).most_common(1)[0][0]
            final_lock_emotion = stable_final
            final_lock_time = now

        # -------- DISPLAY --------
        cv2.putText(frame, f"Face Emotion : {face_emotion}", (20,30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)

        cv2.putText(frame, f"Voice Emotion: {voice_display}", (20,60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200,200,200), 2)

        cv2.putText(frame, f"Final Emotion: {stable_final}", (20,110),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,255,0), 3)

        cv2.imshow("EmoCare | Multimodal Emotion Detection", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

# =========================================
if __name__ == "__main__":
    main()
