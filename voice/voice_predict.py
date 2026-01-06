import librosa
import numpy as np
from tensorflow.keras.models import load_model

model = load_model("voice_cnn_best.h5")
labels = np.array(['angry','calm','disgust','fear','happy','neutral','sad','surprise'])

audio, sr = librosa.load("test.wav", duration=3)
mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40)
feat = np.mean(mfcc.T, axis=0).reshape(1,40,1)

pred = model.predict(feat)
print("Emotion:", labels[np.argmax(pred)])
