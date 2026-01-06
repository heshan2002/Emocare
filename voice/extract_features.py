import librosa
import numpy as np

def extract_mfcc(file):
    audio, sr = librosa.load(file, duration=3)
    mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40)
    return np.mean(mfcc.T, axis=0)
