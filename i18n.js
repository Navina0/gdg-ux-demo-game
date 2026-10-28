/* English / Tamil strings. The language switcher is the deliberately
 * under-discoverable feature in this demo. */
window.I18N = {
  en: {
    title: "Mango Catch", tagline: "Tap the mangoes, avoid the chillies!",
    how: "Tap 🥭 = +1, glowing 🥭 = +3, 🌶️ = lose a life. 3 levels, 20 seconds each.",
    start: "Start", score: "Score", level: "Level", time: "Time", best: "Best",
    pause: "Pause", resume: "Resume", paused: "Paused", hint: "Hint",
    soundOn: "Sound: On", soundOff: "Sound: Off", restart: "Restart",
    levelComplete: "Level complete!", nextLevel: "Get ready for level {n} — faster!",
    gameOver: "Game Over", youWon: "You finished all levels!", outOfLives: "Out of lives",
    share: "Share score", playAgain: "Play again", seeData: "See the analytics →",
    hintText: "Hint: glowing mangoes are worth 3 points — chase those first!",
    shareText: "I scored {n} in Mango Catch! Can you beat me?", copied: "Score copied — paste it anywhere!",
    langChanged: "Language: English"
  },
  ta: {
    title: "மாம்பழம் பிடி", tagline: "மாம்பழங்களைத் தட்டுங்கள், மிளகாய்களைத் தவிர்க்கவும்!",
    how: "🥭 தட்டினால் +1, ஒளிரும் 🥭 +3, 🌶️ தட்டினால் ஒரு உயிர் போகும். 3 நிலைகள், ஒவ்வொன்றும் 20 வினாடிகள்.",
    start: "தொடங்கு", score: "மதிப்பெண்", level: "நிலை", time: "நேரம்", best: "சிறந்தது",
    pause: "இடைநிறுத்து", resume: "தொடர்", paused: "இடைநிறுத்தப்பட்டது", hint: "குறிப்பு",
    soundOn: "ஒலி: ஆன்", soundOff: "ஒலி: ஆஃப்", restart: "மறுதொடக்கம்",
    levelComplete: "நிலை முடிந்தது!", nextLevel: "நிலை {n}-க்கு தயாராகுங்கள் — இன்னும் வேகம்!",
    gameOver: "ஆட்டம் முடிந்தது", youWon: "எல்லா நிலைகளையும் முடித்தீர்கள்!", outOfLives: "உயிர்கள் தீர்ந்தன",
    share: "மதிப்பெண்ணைப் பகிர்", playAgain: "மீண்டும் விளையாடு", seeData: "பகுப்பாய்வைப் பார் →",
    hintText: "குறிப்பு: ஒளிரும் மாம்பழங்களுக்கு 3 புள்ளிகள் — அவற்றை முதலில் பிடியுங்கள்!",
    shareText: "மாம்பழம் பிடி ஆட்டத்தில் நான் {n} மதிப்பெண் பெற்றேன்! உங்களால் முறியடிக்க முடியுமா?",
    copied: "மதிப்பெண் நகலெடுக்கப்பட்டது!", langChanged: "மொழி: தமிழ்"
  }
};
window.t = function (key, vars) {
  var s = (I18N[window.currentLang] || I18N.en)[key] || I18N.en[key] || key;
  if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
  return s;
};
window.applyLang = function (lang) {
  window.currentLang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
  try { localStorage.setItem("lang", lang); } catch (e) {}
};
