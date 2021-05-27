#!/usr/bin/env bash

/usr/local/bin/mjpg_streamer -i input_uvc.so -o 'output_http.so -w /home/augmented/mjpg-streamer/mjpg-streamer-experimental/www' &
/usr/bin/arecord -D plughw:3,0 -c1 -r 16000 -f S16_LE --max-file-time 5 -t wav audio.wav &
sleep 5
