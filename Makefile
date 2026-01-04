.PHONY: build run test clean

build:
	go build -o bin/mkvideo .

run:
	go run .

test:
	go test ./...

clean:
	rm -rf bin

probe_test_1:
	ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_110901.mp4

probe_test_2:
	ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_111721.mp4

glue_test_1:
	ffmpeg -i ./input/20251224_110901.mp4 -i ./input/20251224_110901.mp4 -filter_complex "[0:v][1:v]xfade=transition=pixelize:duration=0.5:offset=10.829689[v]" -map "[v]" -map 0:a -c:v libx264 -crf 20 -preset fast test_output.mp4

glue_test_2:
	@DURATION=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_110901.mp4); \
	OFFSET=$$(echo "$$DURATION - 0.5" | bc); \
	echo "Video duration: $$DURATION seconds, transition offset: $$OFFSET seconds"; \
	ffmpeg -i ./input/20251224_110901.mp4 -i ./input/20251224_110901.mp4 -filter_complex \
	  "[0:v][1:v]xfade=transition=pixelize:duration=0.5:offset=$$OFFSET[v]; \
	   [0:a][1:a]acrossfade=d=0.5[a]" \
	  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset fast test_output.mp4

glue_analog_noise:
	@DURATION=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_110901.mp4); \
	OFFSET=$$(echo "$$DURATION - 0.5" | bc); \
	echo "Video duration: $$DURATION seconds, transition offset: $$OFFSET seconds"; \
	ffmpeg -i ./input/20251224_110901.mp4 -i ./input/20251224_110901.mp4 -filter_complex \
	  "[0:v][1:v]xfade=transition=pixelize:duration=0.5:offset=$$OFFSET,noise=alls=20:allf=t+u[v]; \
	   [0:a][1:a]acrossfade=d=0.5[a]" \
	  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset fast test_output.mp4

glue_vhs_noise:
	@DURATION=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_110901.mp4); \
	OFFSET=$$(echo "$$DURATION - 0.5" | bc); \
	echo "Video duration: $$DURATION seconds, transition offset: $$OFFSET seconds"; \
	ffmpeg -i ./input/20251224_110901.mp4 -i ./input/20251224_110901.mp4 -filter_complex \
	  "[0:v][1:v]xfade=transition=pixelize:duration=0.5:offset=$$OFFSET,noise=alls=50:allf=t+p[v]; \
	   [0:a][1:a]acrossfade=d=0.5[a]" \
	  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset fast test_output.mp4

glue_channel_change:
	@DURATION=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_110901.mp4); \
	OFFSET=$$(echo "$$DURATION - 0.2" | bc); \
	echo "Video duration: $$DURATION seconds, transition offset: $$OFFSET seconds"; \
	ffmpeg -i ./input/20251224_110901.mp4 -i ./input/20251224_110901.mp4 -filter_complex \
	  "[0:v][1:v]xfade=transition=fadeblack:duration=0.2:offset=$$OFFSET,noise=alls=30:allf=t+p[v]; \
	   [0:a][1:a]acrossfade=d=0.2[a]" \
	  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset fast test_output.mp4

glue_glitch_transition:
	@DURATION=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_110901.mp4); \
	GLITCH_DUR=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./effects/digital_glitch_01.mp4); \
	OFFSET=$$(echo "$$DURATION - $$GLITCH_DUR / 2" | bc); \
	echo "Video duration: $$DURATION seconds, glitch duration: $$GLITCH_DUR seconds, overlay offset: $$OFFSET seconds"; \
	ffmpeg -y -i ./input/20251224_110901.mp4 -i ./input/20251224_110901.mp4 -i ./effects/digital_glitch_01.mp4 -filter_complex \
	  "[0:v][1:v]concat=n=2:v=1:a=0[vbase]; \
	   [2:v]scale=1080:1920,colorkey=0x000000:0.3:0.2,setpts=PTS+$$OFFSET/TB[glitch]; \
	   [vbase][glitch]overlay=enable='between(t,$$OFFSET,$$OFFSET+$$GLITCH_DUR)'[v]; \
	   [0:a][1:a]concat=n=2:v=0:a=1[a]" \
	  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset fast test_output.mp4

glue_glitch_youtube:
	@DURATION=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./input/20251224_110901.mp4); \
	GLITCH_DUR=$$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ./effects/digital_glitch_01.mp4); \
	OFFSET=$$(echo "$$DURATION - $$GLITCH_DUR / 2" | bc); \
	echo "Video duration: $$DURATION seconds, glitch duration: $$GLITCH_DUR seconds, overlay offset: $$OFFSET seconds"; \
	ffmpeg -y -i ./input/20251224_110901.mp4 -i ./input/20251224_110901.mp4 -i ./effects/digital_glitch_01.mp4 -filter_complex \
	  "[0:v][1:v]concat=n=2:v=1:a=0[vbase]; \
	   [vbase]scale=-1:1080,pad=1920:1080:(ow-iw)/2:0:black[vpadded]; \
	   [2:v]scale=-1:1080,pad=1920:1080:(ow-iw)/2:0:black,colorkey=0x000000:0.3:0.2,setpts=PTS+$$OFFSET/TB[glitch]; \
	   [vpadded][glitch]overlay=enable='between(t,$$OFFSET,$$OFFSET+$$GLITCH_DUR)'[v]; \
	   [0:a][1:a]concat=n=2:v=0:a=1[a]" \
	  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset fast test_output.mp4

