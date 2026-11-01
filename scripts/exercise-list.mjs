// Source list for the global exercise library.
// [name, type, equipment, primaryMuscle, secondaryMuscles]
// Run `npm run seed:build` after editing to regenerate:
//   src/features/exercises/seed.json  (bundled in the app, works offline)
//   supabase/seed.sql                 (global rows in Postgres)
// IDs are derived from the name, so never rename an existing entry — add a new one.

export const EXERCISES = [
  // Chest
  ['Bench Press (Barbell)', 'weight_reps', 'barbell', 'chest', ['triceps', 'shoulders']],
  ['Bench Press (Dumbbell)', 'weight_reps', 'dumbbell', 'chest', ['triceps', 'shoulders']],
  ['Incline Bench Press (Barbell)', 'weight_reps', 'barbell', 'chest', ['shoulders', 'triceps']],
  ['Incline Bench Press (Dumbbell)', 'weight_reps', 'dumbbell', 'chest', ['shoulders', 'triceps']],
  ['Decline Bench Press (Barbell)', 'weight_reps', 'barbell', 'chest', ['triceps']],
  ['Chest Press (Machine)', 'weight_reps', 'machine', 'chest', ['triceps', 'shoulders']],
  ['Chest Fly (Dumbbell)', 'weight_reps', 'dumbbell', 'chest', ['shoulders']],
  ['Chest Fly (Machine)', 'weight_reps', 'machine', 'chest', ['shoulders']],
  ['Cable Crossover', 'weight_reps', 'cable', 'chest', ['shoulders']],
  ['Push Up', 'bodyweight_reps', 'bodyweight', 'chest', ['triceps', 'shoulders']],
  ['Chest Dip', 'bodyweight_reps', 'bodyweight', 'chest', ['triceps', 'shoulders']],
  ['Chest Dip (Weighted)', 'weighted_bodyweight', 'other', 'chest', ['triceps', 'shoulders']],
  ['Chest Dip (Assisted)', 'assisted_bodyweight', 'machine', 'chest', ['triceps', 'shoulders']],
  ['Pullover (Dumbbell)', 'weight_reps', 'dumbbell', 'chest', ['lats']],

  // Back
  ['Deadlift (Barbell)', 'weight_reps', 'barbell', 'lower_back', ['glutes', 'hamstrings', 'traps', 'forearms']],
  ['Bent Over Row (Barbell)', 'weight_reps', 'barbell', 'upper_back', ['lats', 'biceps']],
  ['Dumbbell Row', 'weight_reps', 'dumbbell', 'upper_back', ['lats', 'biceps']],
  ['Pendlay Row (Barbell)', 'weight_reps', 'barbell', 'upper_back', ['lats', 'biceps']],
  ['T-Bar Row', 'weight_reps', 'machine', 'upper_back', ['lats', 'biceps']],
  ['Seated Cable Row', 'weight_reps', 'cable', 'upper_back', ['lats', 'biceps']],
  ['Seated Row (Machine)', 'weight_reps', 'machine', 'upper_back', ['lats', 'biceps']],
  ['Lat Pulldown (Cable)', 'weight_reps', 'cable', 'lats', ['biceps', 'upper_back']],
  ['Lat Pulldown - Close Grip (Cable)', 'weight_reps', 'cable', 'lats', ['biceps']],
  ['Pull Up', 'bodyweight_reps', 'bodyweight', 'lats', ['biceps', 'upper_back']],
  ['Pull Up (Weighted)', 'weighted_bodyweight', 'other', 'lats', ['biceps', 'upper_back']],
  ['Pull Up (Assisted)', 'assisted_bodyweight', 'machine', 'lats', ['biceps', 'upper_back']],
  ['Chin Up', 'bodyweight_reps', 'bodyweight', 'lats', ['biceps']],
  ['Straight Arm Pulldown (Cable)', 'weight_reps', 'cable', 'lats', []],
  ['Back Extension', 'bodyweight_reps', 'bodyweight', 'lower_back', ['glutes', 'hamstrings']],
  ['Rack Pull', 'weight_reps', 'barbell', 'lower_back', ['traps', 'glutes']],
  ['Shrug (Barbell)', 'weight_reps', 'barbell', 'traps', []],
  ['Shrug (Dumbbell)', 'weight_reps', 'dumbbell', 'traps', []],
  ['Face Pull (Cable)', 'weight_reps', 'cable', 'shoulders', ['upper_back', 'traps']],

  // Shoulders
  ['Overhead Press (Barbell)', 'weight_reps', 'barbell', 'shoulders', ['triceps']],
  ['Shoulder Press (Dumbbell)', 'weight_reps', 'dumbbell', 'shoulders', ['triceps']],
  ['Shoulder Press (Machine)', 'weight_reps', 'machine', 'shoulders', ['triceps']],
  ['Arnold Press (Dumbbell)', 'weight_reps', 'dumbbell', 'shoulders', ['triceps']],
  ['Lateral Raise (Dumbbell)', 'weight_reps', 'dumbbell', 'shoulders', []],
  ['Lateral Raise (Cable)', 'weight_reps', 'cable', 'shoulders', []],
  ['Lateral Raise (Machine)', 'weight_reps', 'machine', 'shoulders', []],
  ['Front Raise (Dumbbell)', 'weight_reps', 'dumbbell', 'shoulders', []],
  ['Rear Delt Fly (Dumbbell)', 'weight_reps', 'dumbbell', 'shoulders', ['upper_back']],
  ['Rear Delt Fly (Machine)', 'weight_reps', 'machine', 'shoulders', ['upper_back']],
  ['Upright Row (Barbell)', 'weight_reps', 'barbell', 'shoulders', ['traps']],

  // Biceps
  ['Bicep Curl (Barbell)', 'weight_reps', 'barbell', 'biceps', ['forearms']],
  ['Bicep Curl (Dumbbell)', 'weight_reps', 'dumbbell', 'biceps', ['forearms']],
  ['Bicep Curl (Cable)', 'weight_reps', 'cable', 'biceps', ['forearms']],
  ['EZ Bar Curl', 'weight_reps', 'barbell', 'biceps', ['forearms']],
  ['Hammer Curl (Dumbbell)', 'weight_reps', 'dumbbell', 'biceps', ['forearms']],
  ['Preacher Curl (Barbell)', 'weight_reps', 'barbell', 'biceps', []],
  ['Preacher Curl (Machine)', 'weight_reps', 'machine', 'biceps', []],
  ['Incline Curl (Dumbbell)', 'weight_reps', 'dumbbell', 'biceps', []],
  ['Concentration Curl', 'weight_reps', 'dumbbell', 'biceps', []],

  // Triceps
  ['Triceps Pushdown (Cable)', 'weight_reps', 'cable', 'triceps', []],
  ['Triceps Rope Pushdown', 'weight_reps', 'cable', 'triceps', []],
  ['Overhead Triceps Extension (Cable)', 'weight_reps', 'cable', 'triceps', []],
  ['Overhead Triceps Extension (Dumbbell)', 'weight_reps', 'dumbbell', 'triceps', []],
  ['Skullcrusher (Barbell)', 'weight_reps', 'barbell', 'triceps', []],
  ['Close Grip Bench Press', 'weight_reps', 'barbell', 'triceps', ['chest']],
  ['Triceps Dip', 'bodyweight_reps', 'bodyweight', 'triceps', ['chest', 'shoulders']],
  ['Triceps Kickback (Dumbbell)', 'weight_reps', 'dumbbell', 'triceps', []],
  ['Bench Dip', 'bodyweight_reps', 'bodyweight', 'triceps', []],

  // Forearms
  ['Wrist Curl (Barbell)', 'weight_reps', 'barbell', 'forearms', []],
  ['Reverse Curl (Barbell)', 'weight_reps', 'barbell', 'forearms', ['biceps']],
  ["Farmer's Walk", 'weight_distance', 'dumbbell', 'forearms', ['traps', 'full_body']],

  // Legs
  ['Squat (Barbell)', 'weight_reps', 'barbell', 'quads', ['glutes', 'hamstrings', 'lower_back']],
  ['Front Squat (Barbell)', 'weight_reps', 'barbell', 'quads', ['glutes', 'abs']],
  ['Goblet Squat', 'weight_reps', 'kettlebell', 'quads', ['glutes']],
  ['Hack Squat (Machine)', 'weight_reps', 'machine', 'quads', ['glutes']],
  ['Leg Press (Machine)', 'weight_reps', 'machine', 'quads', ['glutes', 'hamstrings']],
  ['Leg Extension (Machine)', 'weight_reps', 'machine', 'quads', []],
  ['Bulgarian Split Squat', 'weight_reps', 'dumbbell', 'quads', ['glutes']],
  ['Lunge (Dumbbell)', 'weight_reps', 'dumbbell', 'quads', ['glutes', 'hamstrings']],
  ['Walking Lunge', 'weight_reps', 'dumbbell', 'quads', ['glutes']],
  ['Step Up', 'weight_reps', 'dumbbell', 'quads', ['glutes']],
  ['Bodyweight Squat', 'bodyweight_reps', 'bodyweight', 'quads', ['glutes']],
  ['Romanian Deadlift (Barbell)', 'weight_reps', 'barbell', 'hamstrings', ['glutes', 'lower_back']],
  ['Romanian Deadlift (Dumbbell)', 'weight_reps', 'dumbbell', 'hamstrings', ['glutes', 'lower_back']],
  ['Lying Leg Curl (Machine)', 'weight_reps', 'machine', 'hamstrings', []],
  ['Seated Leg Curl (Machine)', 'weight_reps', 'machine', 'hamstrings', []],
  ['Good Morning (Barbell)', 'weight_reps', 'barbell', 'hamstrings', ['lower_back', 'glutes']],
  ['Hip Thrust (Barbell)', 'weight_reps', 'barbell', 'glutes', ['hamstrings']],
  ['Glute Bridge', 'bodyweight_reps', 'bodyweight', 'glutes', ['hamstrings']],
  ['Cable Kickback', 'weight_reps', 'cable', 'glutes', []],
  ['Hip Abduction (Machine)', 'weight_reps', 'machine', 'abductors', ['glutes']],
  ['Hip Adduction (Machine)', 'weight_reps', 'machine', 'adductors', []],
  ['Sumo Deadlift (Barbell)', 'weight_reps', 'barbell', 'glutes', ['quads', 'hamstrings', 'lower_back']],
  ['Kettlebell Swing', 'weight_reps', 'kettlebell', 'glutes', ['hamstrings', 'lower_back']],
  ['Standing Calf Raise (Machine)', 'weight_reps', 'machine', 'calves', []],
  ['Seated Calf Raise (Machine)', 'weight_reps', 'machine', 'calves', []],
  ['Calf Raise (Bodyweight)', 'bodyweight_reps', 'bodyweight', 'calves', []],

  // Core
  ['Crunch', 'bodyweight_reps', 'bodyweight', 'abs', []],
  ['Cable Crunch', 'weight_reps', 'cable', 'abs', []],
  ['Hanging Leg Raise', 'bodyweight_reps', 'bodyweight', 'abs', []],
  ['Lying Leg Raise', 'bodyweight_reps', 'bodyweight', 'abs', []],
  ['Plank', 'duration', 'bodyweight', 'abs', []],
  ['Side Plank', 'duration', 'bodyweight', 'abs', []],
  ['Russian Twist', 'bodyweight_reps', 'bodyweight', 'abs', []],
  ['Ab Wheel Rollout', 'bodyweight_reps', 'other', 'abs', ['lower_back']],
  ['Sit Up', 'bodyweight_reps', 'bodyweight', 'abs', []],
  ['Dead Bug', 'bodyweight_reps', 'bodyweight', 'abs', []],

  // Full body / Olympic
  ['Clean and Jerk (Barbell)', 'weight_reps', 'barbell', 'full_body', ['quads', 'shoulders']],
  ['Power Clean (Barbell)', 'weight_reps', 'barbell', 'full_body', ['quads', 'traps']],
  ['Snatch (Barbell)', 'weight_reps', 'barbell', 'full_body', ['shoulders', 'quads']],
  ['Thruster (Barbell)', 'weight_reps', 'barbell', 'full_body', ['quads', 'shoulders']],
  ['Burpee', 'bodyweight_reps', 'bodyweight', 'full_body', []],

  // Cardio
  ['Running', 'distance_duration', 'other', 'cardio', []],
  ['Treadmill', 'distance_duration', 'machine', 'cardio', []],
  ['Cycling', 'distance_duration', 'other', 'cardio', []],
  ['Stationary Bike', 'distance_duration', 'machine', 'cardio', []],
  ['Rowing Machine', 'distance_duration', 'machine', 'cardio', ['upper_back']],
  ['Elliptical', 'distance_duration', 'machine', 'cardio', []],
  ['Stair Climber', 'duration', 'machine', 'cardio', ['glutes']],
  ['Jump Rope', 'duration', 'other', 'cardio', ['calves']],
  ['Walking', 'distance_duration', 'other', 'cardio', []],
];
