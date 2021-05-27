	#
# This script is distributed under the GNU General Public License.
#
# by Jonas Lindh, 2005-2006
#
#########################################################################

form Analyze pitch in files
	comment Directory of sound files
	text sound_directory E:\Users\Admin\Documents\workspace\auto_tagging\secondrun\
	#text Filename output1.wav
	sentence Sound_file_extension *.wav
	comment Full path of the resulting text file:
	text resultfile E:\Users\Admin\Documents\workspace\auto_tagging\secondrun\f0results.txt
	text fp_info E:\Users\Admin\Documents\workspace\auto_tagging\secondrun\
	comment Pitch analysis parameters
	integer Window 11
	positive Framerate 0.01
	real Silence_threshold_(dB) -25
	real Minimum_pause_duration_(s) 0.15
	integer RemoveNoise 0
endform


# shorten variables
silencedb = 'silence_threshold'
minpause = 'minimum_pause_duration'
#-----------------------------------------------------------------------------------------
#Constants definition
#------------------------------------------------------------------------------------------
regularBins = 50
binSize=4
limitStd = 200
nroMinFrames = 15
thresholdFP = 0
cleanFrom = 80
cleanTo = 10000
fpCount = 0
currentStringFPInfo$ = "hola"



# Here, you make a listing of all the sound files in a directory.

Create Strings as file list... list 'sound_directory$'*'sound_file_extension$'
numberOfFiles = Get number of strings



# Check if the resultFP file exists:
if fileReadable (resultfile$)
	pause The resultfile 'resultfile$' already exists! Overwrite?
	filedelete 'resultfile$'
endif


writeFileLine:resultfile$, ""

# minimum pause duration
min_pause_dur = 0.2
# minimum duration of sounding parts (phrases)
min_sound_dur = 0.1
# minimum syllable duration
min_syl_dur = 0.08
#minimum frames in a chunk to be processed
minimumframes = window

# Go through all the sound files, one by one:
###############################################################################################
# 1.- First we create a TextGrid with a Tier for representing sound 
# and silence along the whole audio file
###############################################################################################

for ifile to numberOfFiles
	select Strings list
	filename$ = Get string... ifile
	# A sound file is opened...
	Read from file... 'sound_directory$''filename$'
	# Starting from here, you can add everything that should be repeated...
	
	soundname$ = selected$ ("Sound")



	


	######################	NOISE	#######################################
	if removeNoise = 1
		appendInfoLine: "Yoy want me to remove noise"
		Remove noise... 0 0 0.025 'cleanFrom' 'cleanTo' 40 Spectral subtraction
		Rename...  'soundname$'
		Write to WAV file... 'sound_directory$''filename$'
	endif
	
	soundID = selected("Sound")
       
	
	# Use intensity to get threshold
   	To Intensity... 50 0 yes
   	intid = selected("Intensity")
       


   	# estimate noise floor
   	minint = Get minimum... 0 0 Parabolic
   	# estimate noise max
   	maxint = Get maximum... 0 0 Parabolic
   	#get .99 quantile to get maximum (without influence of non-speech sound bursts)
   	max99int = Get quantile... 0 0 0.99
 


   	# estimate Intensity threshold
   	threshold = max99int + silencedb
   	threshold2 = maxint - max99int
   	threshold3 = silencedb - threshold2
   	if threshold < minint
       		threshold = minint
   	endif
	#Settings para el miv acoustic magic dentro del domo con el aire encendido
	#threshold3 = -25.0
	#minpause = 0.1
        appendInfoLine: "Threshold: ", 'threshold'
        appendInfoLine: "Threshold 2: ", 'threshold2'
        appendInfoLine: "Threshold 3: ", 'threshold3'
	
  	# get pauses (silences) and speakingtime
   	To TextGrid (silences)... threshold3 minpause 0.1 silent sounding
   	Write to text file... 'sound_directory$''soundname$'.TextGrid
	select all
	minus Strings list
	Remove
	
endfor
################################################################################################
#2.- With the recently created Textgrid, we iterate over the interval tier discriminating 
# silence parts and analizing only the tagged as sound
###############################################################################################
for ifile to numberOfFiles
	select Strings list
	filename$ = Get string... ifile
	# A sound file is opened...
	Read from file... 'sound_directory$''filename$'
	# Starting from here, you can add everything that should be repeated...
	soundID = selected("Sound")
	soundname$ = selected$ ("Sound")
	
	Read from file... 'sound_directory$''soundname$'.TextGrid
	gridID = selected("TextGrid")

	#Insert interval tier... 1 'sound'
	
	
	writeInfoLine: "Results:"
	numberOfTiers = Get number of tiers
	appendInfoLine: "Number of tiers:",'numberOfTiers'
	
	
	Insert interval tier... numberOfTiers+1 'sound'	
	noi = Get number of intervals... 1

	appendInfoLine: "Number of sounds:",'noi'

	#########################################################
	sep$ = ","
	dir_fp_info$ = fp_info$ + filename$ +"_in.txt"
	if fileReadable (dir_fp_info$)
		pause The resultfile 'dir_fp_info$' already exists! Overwrite?
		filedelete 'dir_fp_info$'
	endif
	

	##########################################################

	# Create a Table with no rows
	table = Create Table with column names: "table", 0, "A B C"
	

	select 'soundID'
	#Formants Extraction
	To Formant (burg)... 0 5 5500 0.025 50

	dur = Get total duration
	startTime = Get start time
	endTime = Get end time
	
	select 'soundID'
	# Use intensity to get threshold
	To Intensity... 50 0 yes
	
	
	
	nchunks = dur/window
	#writeInfoLine: "Results:"
	count_interval_global_file = 1
	for i to noi
		select 'gridID'
		label$ = Get label of interval... 1 'i'
		
		#if label$ = "sounding"		


			start = Get start point... 1 'i'
			end = Get end point... 1 'i'
			
			numberOfTimeSteps = (end - start) / framerate

			
			count_fp_frames = 0
			last_fp_count = 0
			isFilledFrame = 0
			
			if numberOfTimeSteps >= window
				step = (window/2) + 1				
				maxNumberOfTimeSteps = 	numberOfTimeSteps -(window/2)
				
				numero = 1 
				#appendInfoLine: "Here we go !"
				while step <= maxNumberOfTimeSteps
				
					tmin = start + (step - 1) * framerate
	    				tmax = tmin + framerate
					
	    				tminWindowStart = start + (step - 1 - (window/2))*framerate
	    				tminWindowEnd = start + (step - 1 + (window/2))*framerate
	    				tmaxWindowEnd = tminWindowEnd + framerate
					midpoint = (tminWindowStart  + tmaxWindowEnd) / 2


					
					# intensity:
					select Intensity 'soundname$'
                                        intensity_50 = Get value at time... midpoint Cubic
                                        if intensity_50 = undefined
                                             intensity_50 =-50
                                        endif
	
                                        appendFileLine: dir_fp_info$,'count_interval_global_file',",",'i',",",'numero',",",label$,",",'intensity_50'
   				
					#appendInfoLine: "numero:" ,'numero'
					numero = numero + 1
					count_interval_global_file = count_interval_global_file + 1
					step = step + 1
					
				endwhile
			endif
		#endif





	endfor
	


	#appendInfoLine: "write to text","number of FP here : ",'fpCount'


	


	#Write to text file... 'sound_directory$''soundname$'.TextGrid

endfor
Remove
#######################

