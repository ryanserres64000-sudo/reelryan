#!/bin/sh
# The 5 house sound effects (core/timeline.ts EFFETS), synthesised with ffmpeg: no sample, no
# licence to buy. A licensed bank (Epidemic Sound, Artlist…) can replace them later, same names.
# Run from this folder: sh make.sh
F="ffmpeg -hide_banner -loglevel error -y"
A="-ac 2 -ar 44100 -c:a aac -b:a 128k"
$F -f lavfi -i "anoisesrc=c=pink:d=0.6:a=0.6" -af "bandpass=f=1200:width_type=h:w=1600,afade=t=in:d=0.35:curve=qsin,afade=t=out:st=0.35:d=0.25,volume=2.5" $A whoosh.m4a
$F -f lavfi -i "aevalsrc='0.8*sin(2*PI*(500+900*exp(-t*40))*t)*exp(-t*28)':d=0.18:s=44100" $A pop.m4a
$F -f lavfi -i "anoisesrc=c=white:d=0.04:a=0.9" -af "highpass=f=2500,afade=t=out:d=0.04" $A clic.m4a
$F -f lavfi -i "aevalsrc='0.5*(sin(2*PI*1320*t)+0.4*sin(2*PI*2640*t)+0.2*sin(2*PI*3960*t))*exp(-t*4)':d=1.0:s=44100" $A ding.m4a
$F -f lavfi -i "aevalsrc='0.9*sin(2*PI*(45+80*exp(-t*12))*t)*exp(-t*7)':d=0.6:s=44100" $A impact.m4a
