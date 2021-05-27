#!/usr/bin/env bash

DIRECTORY=$1
source ~/.virtualenvs/tensorflow/bin/activate
python python/posture.py $DIRECTORY &
python python/audio.py $DIRECTORY &
python python/slides.py $DIRECTORY &
