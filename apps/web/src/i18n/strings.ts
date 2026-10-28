import type { LocalizedText } from "@setu/engine";

/** UI chrome strings. Every key has `en` and `te`; student-facing content uses LocalizedText in packs. */
export const strings = {
  appName: { en: "Setu", te: "సేతు" },
  language: { en: "Language", te: "భాష" },
  englishOnly: { en: "English only", te: "ఇంగ్లీష్ మాత్రమే" },
  screen: { en: "Screen", te: "స్క్రీన్" },
  parameters: { en: "Parameters", te: "పారామితులు" },
  roleStudent: { en: "I am a student", te: "నేను విద్యార్థిని" },
  roleTeacher: { en: "I am a teacher", te: "నేను ఉపాధ్యాయుడిని" },
  roleDemo: { en: "Try the demo", te: "డెమో చూడండి" },
  noParameters: { en: "None", te: "ఏవీ లేవు" },
  loading: { en: "Loading…", te: "లోడ్ అవుతోంది…" },
  loadFailed: {
    en: "Your lessons could not be loaded. Connect to the internet once, then try again.",
    te: "మీ పాఠాలు లోడ్ కాలేదు. ఒకసారి ఇంటర్నెట్‌కు కనెక్ట్ అయి మళ్ళీ ప్రయత్నించండి.",
  },
  tryAgain: { en: "Try again", te: "మళ్ళీ ప్రయత్నించు" },
  back: { en: "Back", te: "వెనుకకు" },
  classroomCode: { en: "Classroom code", te: "తరగతి కోడ్" },
  rollNo: { en: "Roll number", te: "రోల్ నంబర్" },
  pin: { en: "4-digit PIN", te: "4 అంకెల పిన్" },
  signIn: { en: "Sign in", te: "లోపలికి వెళ్ళు" },
  signingIn: { en: "Signing in…", te: "లోపలికి వెళ్తోంది…" },
  loginFailed: {
    en: "The classroom code, roll number or PIN is not right. Ask your teacher.",
    te: "తరగతి కోడ్, రోల్ నంబర్ లేదా పిన్ సరిగ్గా లేదు. మీ ఉపాధ్యాయుడిని అడగండి.",
  },
  whoIsLearning: { en: "Who is learning now?", te: "ఇప్పుడు ఎవరు నేర్చుకుంటున్నారు?" },
  addStudent: { en: "Add a student on this phone", te: "ఈ ఫోన్‌లో విద్యార్థిని చేర్చు" },
  enterPin: { en: "Enter your PIN", te: "మీ పిన్ ఇవ్వండి" },
  wrongPin: { en: "That PIN is not right. Try again.", te: "ఆ పిన్ సరైనది కాదు. మళ్ళీ ప్రయత్నించండి." },
  open: { en: "Open", te: "తెరువు" },
  switchStudent: { en: "Switch student", te: "విద్యార్థిని మార్చు" },
  rollShort: { en: "Roll", te: "రోల్" },
  hello: { en: "Hello", te: "నమస్తే" },
  start: { en: "Start", te: "మొదలుపెట్టు" },
  modeReadiness: { en: "Getting started", te: "ప్రారంభం" },
  modeLearn: { en: "Learn", te: "నేర్చుకో" },
  modeSolve: { en: "Practise", te: "అభ్యాసం" },
  modeTest: { en: "Test", te: "పరీక్ష" },
  modeRecheck: { en: "Quick check", te: "చిన్న పరిశీలన" },
  modeVerify: { en: "Confirm", te: "నిర్ధారణ" },
  modeExtension: { en: "Challenge", te: "సవాలు" },
  modeDone: { en: "All done", te: "పూర్తయింది" },
  yourAnswer: { en: "Your answer", te: "నీ జవాబు" },
  showHint: { en: "Show a hint", te: "సూచన చూపించు" },
  correct: { en: "Correct!", te: "సరైనది!" },
  notQuite: { en: "Not quite.", te: "సరిగ్గా కాదు." },
  theAnswerIs: { en: "The answer is", te: "సరైన జవాబు:" },
  next: { en: "Next", te: "తర్వాత" },
  levelOf: { en: "Level {level} of 3", te: "స్థాయి {level} / 3" },
  submit: { en: "Submit", te: "సమర్పించు" },
  continue: { en: "Continue", te: "కొనసాగించు" },
  readinessTitle: { en: "Readiness check", te: "సన్నద్ధత పరీక్ష" },
  questionOfUpTo: { en: "Question {n} of up to {max}", te: "ప్రశ్న {n} (గరిష్టంగా {max})" },
  readinessCleared: {
    en: "You showed {cleared} of the {total} skills we checked.",
    te: "మేము పరిశీలించిన {total} నైపుణ్యాలలో {cleared} నీకు వచ్చు.",
  },
  readinessNoChecks: {
    en: "Nothing needed checking before this chapter.",
    te: "ఈ అధ్యాయం ముందు పరిశీలించాల్సింది ఏమీ లేదు.",
  },
  readinessStartWith: { en: "We will begin with {concept}.", te: "మనం {concept} తో మొదలుపెడదాం." },
  readinessReady: {
    en: "You are ready to start {chapter}.",
    te: "నువ్వు {chapter} మొదలుపెట్టడానికి సిద్ధంగా ఉన్నావు.",
  },
} as const satisfies Record<string, Required<Pick<LocalizedText, "en" | "te">>>;

export type StringKey = keyof typeof strings;

/** Language names are shown in their own script so a student can always find theirs. */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "te", label: "తెలుగు" },
] as const;
