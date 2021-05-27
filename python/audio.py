#Imports
from pydub import AudioSegment
import subprocess
import os
import sys
import time
import signal
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import json
import asyncio
import parselmouth
from parselmouth.praat import call, run_file
import numpy as np
import webrtcvad
import pyloudnorm as pyln
import math


#Sensing new wav file
class Watcher:
    directory = ""

    def __init__(self):
        self.observer = Observer()

    def run(self,directory):
        event_handler = Handler()
        self.observer.schedule(event_handler, directory, recursive=True)
        self.directory=directory
        self.observer.start()
        #try:
        #    while True:
        #        time.sleep(5)
        #except:
        #    self.observer.stop()
        #    print("Error")

        #self.observer.join()

class Handler(FileSystemEventHandler):
    lastFile = 'None'
    @staticmethod
    def on_any_event(event):
        if event.is_directory:
            return None

        elif event.event_type == 'created':
            file = event.src_path.strip()
            if (".wav" in file and ".txt" not in file):
                if "audio.wav" in file:
                    file="audio-01.wav"
                if "None"!=Handler.lastFile:
                    filled_pauses_analysis(os.path.basename(Handler.lastFile))
                    speech_rate_analysis(os.path.basename(Handler.lastFile))
                    intensity_analysis_2(os.path.basename(Handler.lastFile))
                Handler.lastFile=file

#Excution
originalDir=sys.argv[1]
directory=originalDir+"/Audio"
os.mkdir(directory)
os.mkdir(directory+"/segments")
os.mkdir(directory+"/praatOutput")
os.mkdir(directory+"/fp")
totalNumberOfFilledPauses=0
executable = "/usr/bin/praat"
praatScriptPath =  "/home/augmented/opaf/Control/praat/FilledPausesFinder"
praatSpeechRateScriptPath  = "/home/augmented/opaf/Control/praat/SpeechRate.praat"
praatIntensityScriptPath  = "/home/augmented/opaf/Control/praat/IntensityFinder.praat"
fileDirectory = directory+"/segments/"
outputfile =  directory+"/f0results.txt"
outputfileFP = directory+"/praatOutput/"
window =10
framerate =0.01
silence_Threshold=-10
minimum_Pause_Duration=0.15
removeNoise =0
minimum_dip_peaks = 2
speechrate_segments = []
average_speech_rate = 0

globalFPCount=0

infoAudio = {}
infoAudio['FilledPauses']=[]
infoAudio['Volumes'] = []
infoAudio['SpeechRate']=[]

def FindFPInTextGrid(dirname, name, infoAudio):
    NFP = 0
    cutResult=0
    listOfFPs  = list()
    global globalFPCount
    with open(dirname + name + ".txt") as f:
        lines = f.readlines()
        for line in lines:
            lineaInfoFP = line.split(',')
            if(True): #try:

                currentFP  = int(lineaInfoFP[0])
                listOfFPs.append(int(lineaInfoFP[0]))

                #reading the times start and end where supossed to be
                if(currentFP>0):
                    time_start = float(lineaInfoFP[1])
                    time_end = float(lineaInfoFP[2])
                    #converting to miliseconds
                    time_start_round = round(time_start,3)*1000
                    time_end_round = round(time_end,3)*1000

                    cutResult = cutAudioFile(name , currentFP, int(time_start_round), int(time_end_round))
                    print("CutResulted: ", cutResult)
                    if cutResult != -1:

                        #Go Save in the JSON file
                        infoAudio['FilledPauses'].append({
                            'number':globalFPCount + currentFP,
                            'start':int(time_start_round),
                            'end':int(time_end_round),
                            'path':cutResult
                    })
            else: #except:
                currentFP = 0
            listOfFPs.append(currentFP)


    NFP  = max(listOfFPs)
    globalFPCount += NFP
    return NFP

def cutAudioFile(filename, index, timeStart, timeEnd ):

    print("Looking for :" + directory+"/segments/"+filename)
    if(True):
        audioFile = AudioSegment.from_wav(directory+"/segments/"+filename)
        totalLength = len(audioFile)
        print("Total audio lenght:" + str(totalLength))
        if timeStart > 2000:
            timeStartCrop = timeStart - 2000
        else:
            timeStartCrop = 1

        timeEndDiff = totalLength - timeEnd
        if timeEndDiff >= 2000:
            timeEndCrop = timeEnd + 2000

        else:
            timeEndCrop = totalLength

        segment =audioFile[timeStartCrop:timeEndCrop]
        name, file_extension = os.path.splitext(filename)
        exportedName = name + "_" + str(index) + ".wav"
        segment.export(directory+"/fp/"+os.path.basename(exportedName), format = "wav")
        return directory+"/fp/"+os.path.basename(exportedName)
    else: #except:
        print("MLAAudioTools: Error could not split the audio file")
        return -1

def FindSRInTextGrid(dir,name, infoAudio):
    NFP = 0.0
    with open(dir+name + "_sr.txt") as f:
        lines = f.readlines()
        for line in lines:
            try:
                currentSR  = float(line)
                NFP += currentSR
                infoAudio['SpeechRate'].append({
                    'filepath':name,
                    'avgspeechrate':currentSR,
                })
            except:
                currentSR = 0.0
    return NFP

def FindInInTextGrid(name, infoAudio):
    with open(name +"_in.txt" ) as f:
        intensities = [ float(line.split(',')[4]) for line in f.readlines()]
        data = {"volumes" : intensities}
        infoAudio['Volumes'].append({
             'filepath':name,
             'volumes':data,
         })
        return len(data)

def filled_pauses_analysis(recordedFileName):
    global totalNumberOfFilledPauses
    runLine =   executable + " --run " +  praatScriptPath + " "+ fileDirectory + " " + recordedFileName + " " + outputfile + " "+ outputfileFP+" "+ str(window) + " " + str(framerate) + " " + str(silence_Threshold) + " " +str(minimum_Pause_Duration) +" "+ str(removeNoise)
    if(True): #try:
        subprocess.call([executable, "--run", praatScriptPath, fileDirectory,recordedFileName, outputfile, outputfileFP,str(window), str(framerate), str(silence_Threshold), str(minimum_Pause_Duration),str(removeNoise)])
        numberofFilledPauses = FindFPInTextGrid(outputfileFP , recordedFileName, infoAudio)
    else: #except:
        numberofFilledPauses = 0
    totalNumberOfFilledPauses = totalNumberOfFilledPauses + numberofFilledPauses
    #print(totalNumberOfFilledPauses)

def speech_rate_analysis(recordedFileName):
    try:
        objects= run_file(praatSpeechRateScriptPath, -20, 2, 0.3, "yes",fileDirectory+recordedFileName,outputfileFP, 80, 400, 0.01, capture_output=True)
        z1=str(objects[1]) # This will print the info from the textgrid object, and objects[1] is a parselmouth.Data object with a TextGrid inside
        if not "noisy" in z1:
            z2=z1.strip().split()
            z3=np.array(z2)
            articulation=float(z3[3])
            rate="Normal"
            if(articulation<4):
               rate="Slow"
            elif(articulation>4):
               rate="Fast"
            infoAudio['SpeechRate'].append({
               'filepath':recordedFileName,
               'articulationRate':articulation,
               'rate': rate
               })
            print("Articulation Rate:",articulation)
            print("File:",recordedFileName)
        else:
            infoAudio['SpeechRate'].append({
               'filepath':recordedFileName,
               'articulationRate':0,
               'rate': "No Speech Detected"
            })
    except:
        infoAudio['SpeechRate'].append({
           'filepath':recordedFileName,
           'articulationRate':0,
           'rate': "Error detecting"
        })

def intensity_analysis(recordedFileName):
    print([executable,"--run", praatIntensityScriptPath, fileDirectory,recordedFileName, outputfile, outputfileFP,str(window), str(framerate), str(silence_Threshold), str(minimum_Pause_Duration),str(removeNoise)])
    if(True):

        subprocess.call([executable,"--run", praatIntensityScriptPath, fileDirectory,recordedFileName, outputfile, outputfileFP,str(window), str(framerate), str(silence_Threshold), str(minimum_Pause_Duration),str(removeNoise)])

        volumes = FindInInTextGrid(outputfileFP + recordedFileName, infoAudio)
    #except Exception as ex:
    #    print("MLAaudioTools: Error at executing INTENSITY praat script")

def intensity_analysis_2(recordedFileName):
    vad = webrtcvad.Vad()
    vad.set_mode(3)

    snd = parselmouth.Sound(fileDirectory+"/"+recordedFileName)
    intensity = snd.to_intensity(minimum_pitch=50.0,time_step=0.01)
    lengthSound=snd.get_number_of_samples()

    speechIntervals=[]
    for i in range(0,lengthSound,160):
        part=snd.values.T[i:i+(160)]
        sound=[]
        for sample in part:
            sound.append(sample[0]*32768)
        todetect=np.array(sound)
        todetect=todetect.astype(np.int16)
        vadDetection=vad.is_speech(todetect.tobytes(), 16000)
        if vadDetection:
            speechIntervals.append(1)
        else:
            speechIntervals.append(0)
    intervals=sum(speechIntervals)

    meter = pyln.Meter(16000)
    power=[]
    for i in range(0,lengthSound,8000):
        loudness = meter.integrated_loudness(snd.values.T[i:i+8000])
        time=i/16000
        position=int(100*time)
        speechInterval=speechIntervals[position:position+50]
        speech=sum(speechInterval)>15
        if (speech):
            power.append(loudness)
    loudness = meter.integrated_loudness(snd.values.T)
    meanPower=np.mean(power)
    if math.isnan(meanPower):
        meanPower=0
    infoAudio['Volumes'].append({
         'filepath':recordedFileName,
         'speechIntervals':intervals,
         'soundIntensity':loudness,
         'meanSpeechIntensity':meanPower
     })
    return np.mean(power)

w= Watcher()
w.run(directory+"/segments")

#proc_args = ['arecord', '-D' , 'dmic_sv' , '-c2' , '-r' , '44100' , '-f' , 'S32_LE' , '-t' , 'wav' , '-V' , 'mono' , '-v' , 'subprocess1.wav']
proc_args = ['arecord', '-D' , 'plughw:3,0' , '-c1' , '-r' , '16000' , '-f' , 'S16_LE' , '--max-file-time', '5', '-t' , 'wav'  , directory+'/segments/audio.wav']
rec_proc = subprocess.Popen(proc_args, shell=False, preexec_fn=os.setsid)
print("startRecordingArecord()> rec_proc pid= " + str(rec_proc.pid))
print("startRecordingArecord()> recording started")

while(True):
    if os.path.exists(originalDir+"/stop.signal"):
        break
    time.sleep(5)
os.killpg(rec_proc.pid, signal.SIGTERM)
rec_proc.terminate()
rec_proc = None
time.sleep(5)
w.observer.stop()
w.observer.join()
with open(directory+'/result.json', 'w') as fp:
    json.dump(infoAudio, fp)
