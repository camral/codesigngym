#!/usr/bin/env bash
# Build the per-family showcase clips (static/video/showcase/<family>.mp4 + .jpg) from the fetched eval rollouts.
# Picks favour rollouts where the robot stays in frame (the v4 eval cameras are fixed, so fast gaits leave the frame).
set -euo pipefail
cd "$(dirname "$0")/.."
V=static/video; O=$V/showcase; mkdir -p "$O"
enc=(-c:v libx264 -crf 25 -preset slow -pix_fmt yuv420p -movflags +faststart -an)
clip() { # name src [trim_seconds]
  local t=(); [ -n "${3:-}" ] && t=(-t "$3")
  ffmpeg -v error -y -i "$2" ${t[@]+"${t[@]}"} -vf "scale='min(640,iw)':-2:flags=lanczos" "${enc[@]}" "$O/$1.mp4"
  local d; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$O/$1.mp4")
  ffmpeg -v error -y -ss "$(python3 -c "print(float('$d')*0.5)")" -i "$O/$1.mp4" -frames:v 1 -q:v 3 "$O/$1.jpg"
}
clip ballcatcher  $V/BallCatcher-Arc/loki.mp4
clip solar        $V/SolarCleanerTraverse/cmaes.mp4
clip truck        $V/TruckUnloadSingle/fasttd3.mp4
clip nerograsp    $V/NeroGraspAll/cmaes.mp4
clip hand         $V/extra/hand_morph.mp4
clip lq           $V/LQStructure-LQR-v0/loki.mp4
clip microgrid    $V/MicrogridOffGridCampus/cmaes.mp4
clip network      $V/NetworkUrban/ppo_ngopt.mp4
clip racing       $V/RacingSpielberg/fasttd3.mp4 14
clip warehouse    $V/WarehouseCongested/ppo_ngopt.mp4
clip softwalker   $V/extra/SoftWalkerHexFEM3D-Gaps.mp4
# classic MuJoCo ports: 2x2 montage; fixed-camera rollouts are follow-cropped around the robot first (HalfCheetah's camera already tracks)
P=${PYTHON:-python}; T=$V/extra/tracked; mkdir -p "$T"
$P tools/track_crop.py $V/Hopper-v4/cmaes.mp4 $T/hopper.mp4 180
$P tools/track_crop.py $V/Swimmer-v4/fasttd3.mp4 $T/swimmer.mp4 160
$P tools/track_crop.py $V/HumanoidStandup-v4/fasttd3.mp4 $T/standup.mp4 220
ffmpeg -v error -y -i $T/hopper.mp4 -i $V/HalfCheetah-v4/ppo_ngopt.mp4 -i $T/swimmer.mp4 -i $T/standup.mp4 -t 10 \
  -filter_complex "[0]scale=320:320[a];[1]scale=320:320[b];[2]scale=320:320[c];[3]scale=320:320[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0" \
  "${enc[@]}" "$O/gym.mp4"
ffmpeg -v error -y -ss 3 -i "$O/gym.mp4" -frames:v 1 -q:v 3 "$O/gym.jpg"
ls -la "$O"; du -sh "$O"

# hero wall: the six most dynamic final-eval rollouts, one per domain (picked by mean frame-to-frame motion), square-cropped on the action
Hh=$V/hero; mkdir -p "$Hh"
hero() { # name src crop_filter [trim_start] [trim_len]
  local ss=(); [ -n "${4:-}" ] && ss=(-ss "$4"); local t=(); [ -n "${5:-}" ] && t=(-t "$5")
  ffmpeg -v error -y ${ss[@]+"${ss[@]}"} -i "$2" ${t[@]+"${t[@]}"} -vf "$3,scale=360:360:flags=lanczos" "${enc[@]}" "$Hh/$1.mp4"
  local d; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$Hh/$1.mp4")
  ffmpeg -v error -y -ss "$(python3 -c "print(float('$d')*0.4)")" -i "$Hh/$1.mp4" -frames:v 1 -q:v 3 "$Hh/$1.jpg"
}
# Humanoid (FastTD3, return 5,956): the fixed camera keeps the runner centred for ~2.7 s before it reaches the frame edge, so follow-crop that stretch
ffmpeg -v error -y -i $V/Humanoid-v4/fasttd3.mp4 -t 2.7 "${enc[@]}" $T/humanoid_visible.mp4
$P tools/track_crop.py $T/humanoid_visible.mp4 $T/humanoid.mp4 185 360
hero humanoid  $T/humanoid.mp4                      "crop=360:360:0:0"
hero truck     $V/TruckUnloadSingle/fasttd3.mp4     "crop=400:400:60:40"
hero racing    $V/RacingSpielberg/ppo_ngopt.mp4     "crop=420:420:0:0"          ""   12
hero warehouse $V/WarehouseSmall/ppo_ngopt.mp4      "crop=302:302:0:0"
hero grasp     $V/NeroGraspAll/ppo_ngopt.mp4        "crop=360:360:110:0"
hero network   $V/NetworkUrban/ppo_ngopt.mp4        "crop=372:372:0:14"         0.05
ls -la "$Hh"

# hero wall soft robot: the env's own 3D render (HexFEM on Gaps), square-cropped on the body; 31 frames played at 12 fps
ffmpeg -v error -y -r 12 -i ../codesign-gym/soft_walker_renders/SoftWalkerHexFEM3D-Gaps.gif -vf "crop=1100:1100:730:310,scale=360:360:flags=lanczos,format=yuv420p" "${enc[@]}" -r 12 "$Hh/softwalker.mp4"
ffmpeg -v error -y -ss 1.2 -i "$Hh/softwalker.mp4" -frames:v 1 -q:v 3 "$Hh/softwalker.jpg"

# one clip per Extended family (Walker2d and Ant use the paper's Figure 3 stills: their fixed eval camera loses the robot within ~1 s)
ext() { ffmpeg -v error -y -i "$2" ${3:+-t} ${3:+"$3"} -vf "scale=480:-2:flags=lanczos" "${enc[@]}" "$O/$1.mp4"; ffmpeg -v error -y -ss 1.5 -i "$O/$1.mp4" -frames:v 1 -q:v 3 "$O/$1.jpg"; }
ext halfcheetah $V/HalfCheetah-v4/ppo_ngopt.mp4 10
ext hopper $T/hopper.mp4 10
ext swimmer $T/swimmer.mp4 10
ext humanoid $T/humanoid.mp4
ext humanoidstandup $T/standup.mp4 10
cp "$O/hand.mp4" "$O/rotateinhand.mp4"; cp "$O/hand.jpg" "$O/rotateinhand.jpg"
