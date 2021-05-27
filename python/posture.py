#Imports
#**************************
import sys
import cv2
import os
from sys import platform
import argparse
import shutil
import random
import csv

#Functions
#**************************
def createFolders(path):
     print(path)
     try:
          os.mkdir(path)
          os.mkdir(path + "/Public")
          os.mkdir(path + "/Up")
          os.mkdir(path + "/Down")
          os.mkdir(path + "/Right")
          os.mkdir(path + "/Left")
          os.mkdir(path + "/Slides")
          os.mkdir(path + "/Correct")
          os.mkdir(path + "/BackToPublic")
          os.mkdir(path + "/HandsTogether")
          os.mkdir(path + "/HandsDown")
          os.mkdir(path + "/tempFrames")
     except:
          print("Directories already created")

def select_biggest_skeleton(keypoints):
    max_id = 0;
    max_size = 0;
    for i in range(0,keypoints.shape[0]):
        rhip_y = keypoints[i, 8, 1]
        lhip_y = keypoints[i, 11, 1]
        neck_y = keypoints[i, 1, 1]
        size = 0
        if (neck_y != 0 and (rhip_y != 0 or lhip_y != 0)):
             size = (rhip_y + lhip_y) / 2 - neck_y
             if (size > max_size):
                  max_size = size
                  max_id = i
    return max_id

def getHeadRectangle(keypoints,bodyId):
    nose_x = keypoints[bodyId][0][0]
    nose_y = keypoints[bodyId][0][1]
    mhip_y = keypoints[bodyId][8][1]
    normalizer=(mhip_y-nose_y)/4
    if nose_y==0:
        return 0,0,0,0
    else:
        x=nose_x-normalizer
        y=nose_y-normalizer
        width=normalizer*2
        height=normalizer*2
        return x,y,width,height

def headPostureSkeleton(keypoints,bodyId):
    rshoulder_x = keypoints[bodyId][2][0]
    lshoulder_x = keypoints[bodyId][5][0]
    mhip_y = keypoints[bodyId][8][1]
    neck_x = keypoints[bodyId][1][0]
    neck_y = keypoints[bodyId][1][1]
    nose_x = keypoints[bodyId][0][0]
    nose_y = keypoints[bodyId][0][1]
    reye_x = keypoints[bodyId][15][0]
    reye_y = keypoints[bodyId][15][1]
    leye_x = keypoints[bodyId][16][0]
    leye_y = keypoints[bodyId][16][1]
    rear_x = keypoints[bodyId][17][0]
    rear_y = keypoints[bodyId][17][1]
    lear_x = keypoints[bodyId][18][0]
    lear_y = keypoints[bodyId][18][1]
    rdist=reye_x-rear_x
    ldist=lear_x-leye_x
    difference=ldist-rdist
    normalizer= (mhip_y-neck_y)/13


    average_ear=(rear_y+lear_y)/2
    average_eye=(reye_y+leye_y)/2
    distance_eyes=(leye_x-reye_x)
    distance_leye_nose=(leye_x-nose_x)
    distance_reye_nose=(nose_x-reye_x)
    atitude=average_ear-nose_y
    print(rdist,ldist,difference,normalizer,average_ear,nose_y,atitude,average_eye,distance_eyes,distance_leye_nose,distance_reye_nose)
    if rshoulder_x != 0 and lshoulder_x != 0 and lshoulder_x < rshoulder_x: #Persona de espaldas
        return "Slides"
    if rear_x==0 and abs(difference)>normalizer:
        return "Left"
    if lear_x==0 and abs(difference)>normalizer:
        return  "Right"
    if difference>normalizer:
        return "Right"
    else:
        if difference<-(normalizer):
            return "Left"
    if atitude>((normalizer/3)):
        return "Up"
    else:
        if atitude<-(normalizer/1.2):
            return "Down"
    return "Public"

def bodyPosture(keypoints, person_index, face_orientation, head_height):
    rwrist_y = keypoints[person_index][4][1]
    rwrist_x = keypoints[person_index][4][0]
    lwrist_y = keypoints[person_index][7][1]
    lwrist_x = keypoints[person_index][7][0]
    mhip_y = keypoints[person_index][8][1]
    lhip_y = keypoints[person_index][11][1]
    neck_y = keypoints[person_index][1][1]
    nose_y = keypoints[person_index][0][1]
    rshoulder_x = keypoints[person_index][2][0]
    lshoulder_x = keypoints[person_index][5][0]

    if rshoulder_x != 0 and lshoulder_x != 0 and lshoulder_x < rshoulder_x: #Persona de espaldas
        return "BackToPublic"
    if mhip_y == 0:
        return "NA"
    if lwrist_y == 0:
        lwrist_y = rwrist_y
    if rwrist_y == 0:
        rwrist_y = lwrist_y
    if rwrist_y == 0:
        return "NA"

    hand_distance_threshold = (neck_y - nose_y)*2
    spinebase = mhip_y
    spinemid = ((3*spinebase) + neck_y)/4
    #spinemid = spinebase-3*hand_distance_threshold
    normalizer = 0
    if head_height > 0:
       normalizer= head_height
    else:
       normalizer=HAND_MID_SPINE_THRESHOLD
    #if lwrist_y < (spinemid - (HAND_MID_SPINE_THRESHOLD/head_height)) or rwrist_y < (spinemid - (HAND_MID_SPINE_THRESHOLD/head_height)):
    if lwrist_y < spinemid or rwrist_y < spinemid:
        if rwrist_x != 0 and lwrist_x != 0 and abs(rwrist_x - lwrist_x) < hand_distance_threshold:
            return "HandsTogether"
        return "Correct"
    return "HandsDown"

def captureFacePoseImages(frameNumber,img, actualOrientation, lastOrientation, mode, x, y, width, height):
    #Mode 0 Face, Mode 1 Pose
    x=int(x)
    y=int(y)
    width=int(width)
    height=int(height)
    if (mode != 0 and mode != 1):
        return
    if actualOrientation=="NA" :
        return
    if actualOrientation!=lastOrientation:
        return
    if actualOrientation in imgDictionary.keys():
        countImage=imgDictionary[actualOrientation]
    else:
        countImage=0
    countImage=countImage+1

    imgDictionary[actualOrientation]=countImage
    if (mode == 0 and height>1 and width>1):
         # Condiciones que debe cumplir el ROI
         # box within the image plane
         img=img[y:y+height,x:x+width]
         imgheight, imgwidth, channels = img.shape
         if imgheight>0 and imgwidth>0:
             img=cv2.resize(img, (200, 200))
    cv2.imwrite(directory+"/"+ actualOrientation+"/img_" + str(frameNumber)+".jpg", img)

def selectRandomImages(maxImages):
    path = self.filename
    for pose in imgDictionary.keys():
        value = imgDictionary[pose]
        if value>maxImages:
            randomValues=random.sample(range(1, value+1), maxImages)
        else:
            randomValues=range(1,value+1)
        for number in randomValues:
            img = cv2.imread(path+"/"+pose+"/img"+ str(number) + ".jpg")
            cv2.imwrite(path+ "/img" +str(number) +"_"+pose+ ".jpg", img)

def writeToRapCsv(frame, posture, face):
    resultfile.writerow([frame, face, posture])


#To execute

# Import Openpose (Windows/Ubuntu/OSX)
dir_path = os.path.dirname(os.path.realpath(__file__))
sys.path.append('/home/augmented/openpose/build/python');
from openpose import pyopenpose as op

# arguments
originalDir=sys.argv[1]
directory=originalDir+"/Video"

# Custom Params (refer to include/openpose/flags.hpp for more parameters)
params = dict()
params["model_folder"] = "/home/augmented/openpose/models/"
params["net_resolution"]= "256x256"

# Starting OpenPose
opWrapper = op.WrapperPython()
opWrapper.configure(params)
opWrapper.start()

cam = cv2.VideoCapture(0)
cam.set(3,640)#width
cam.set(4,480)#Height
ret_val, image = cam.read()
datum = op.Datum()
frameNumber=0

createFolders(directory)
imgDictionary={}
lastHeadPosture="None"
lastBodyPosture="None"
fourcc = cv2.VideoWriter_fourcc(*'H264')
videoFile = cv2.VideoWriter(directory+'/video.avi',fourcc, 2.0, (640,480))
csv_file=open(directory+'/result.csv', mode='w')
resultfile = csv.writer(csv_file, delimiter=',')
resultfile.writerow(["frame","looks","positions"])

while True:
    ret_val, image = cam.read()
    frameNumber=frameNumber+1
    datum.cvInputData = image
    opWrapper.emplaceAndPop([datum])
    keypoints=datum.poseKeypoints
    if(keypoints is not None and keypoints.ndim>0 and keypoints.shape[0]>0):
        bodyId=select_biggest_skeleton(keypoints)
        headx,heady,headw,headh=getHeadRectangle(keypoints,bodyId)
        head_height=headh
        try:
            hp=headPostureSkeleton(keypoints,bodyId)
            bp=bodyPosture(keypoints,bodyId,hp,head_height)
            writeToRapCsv(frameNumber, bp, hp)
            captureFacePoseImages(frameNumber,image, hp, lastHeadPosture, 0, headx, heady, headw, headh)
            captureFacePoseImages(frameNumber,image, bp, lastBodyPosture, 1, headx, heady, headw, headh)
            lastHeadPosture=hp
            lastBodyPosture=bp
            print(frameNumber,hp,bp)
        except:
            writeToRapCsv(frameNumber, "NA", "NA")
    else:
        writeToRapCsv(frameNumber, "NA", "NA")
    videoFile.write(datum.cvOutputData)
    if os.path.exists(originalDir+"/stop.signal"):
        break

csv_file.close()
videoFile.release()
