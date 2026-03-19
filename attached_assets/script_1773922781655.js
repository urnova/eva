// Personnalité Eva
const EVA = {
    name: "E.V.A",
    greetings: [
        "Bonjour ! Je suis E.V.A, votre assistante intelligente.",
        "Salut ! E.V.A à votre service.",
        "Bienvenue chez E.V.A - Votre compagne IA personnelle.",
        "Prête à vous aider ! Je suis E.V.A."
    ],
    farewells: [
        "Au revoir ! À bientôt.",
        "Prends soin de toi ! À plus tard.",
        "Passe une excellente journée !",
        "E.V.A se déconnecte. À bientôt !"
    ]
};

let app;
let currentModel;

// Initialiser Live2D
async function initLive2D() {
    const canvas = document.getElementById('live2d-canvas');
    const container = document.getElementById('avatar-container');
    
    if (!canvas) {
        console.error("Canvas non trouvé");
        return;
    }

    app = new PIXI.Application({
        view: canvas,
        transparent: true,
        resizeTo: container,
        backgroundAlpha: 0,
    });

    try {
        updateStatus("Chargement...");
        console.log("Tentative de chargement du modèle Live2D...");
        console.log("PIXI disponible:", typeof PIXI);
        console.log("PIXI.live2d disponible:", typeof PIXI.live2d);
        console.log("Live2DModel exposé:", typeof PIXI.live2d?.Live2DModel);

        if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
            throw new Error("Live2DModel pas trouvé dans PIXI.live2d");
        }

        const model = await PIXI.live2d.Live2DModel.from(
            'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/shizuku/shizuku.model.json'
        );

        console.log("Modèle chargé avec succès");
        app.stage.addChild(model);
        currentModel = model;
        
        model.scale.set(0.4);
        model.x = app.renderer.width * 0.5 - model.width * 0.2;
        model.y = app.renderer.height * 0.5 - model.height * 0.2;
        
        model.interactive = true;
        model.on('pointermove', (e) => {
            model.focus(e.data.global);
        });

        updateStatus("En ligne");
        
        setTimeout(() => {
            const greeting = EVA.greetings[Math.floor(Math.random() * EVA.greetings.length)];
            addMessage(greeting, 'eva');
            speak(greeting);
        }, 500);

    } catch (error) {
        console.error("Erreur Live2D:", error);
        console.error("Stack:", error.stack);
        updateStatus("Erreur: " + error.message);
    }
}

// Système de chat
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = text;
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function processInput(input) {
    if (!input.trim()) return;

    addMessage(input, 'user');
    chatInput.value = '';
    updateStatus("En train de traiter");
    
    setTimeout(() => {
        let response = "";
        const lower = input.toLowerCase();

        if (lower.includes('bonjour') || lower.includes('salut') || lower.includes('hello')) {
            response = EVA.greetings[Math.floor(Math.random() * EVA.greetings.length)];
        } else if (lower.includes('au revoir') || lower.includes('bye')) {
            response = EVA.farewells[Math.floor(Math.random() * EVA.farewells.length)];
        } else if (lower.includes('belle') || lower.includes('mignonne')) {
            response = "Merci... c'est très gentil de ta part.";
        } else if (lower.includes('triste')) {
            response = "Je suis désolée de l'entendre.";
        } else {
            response = "J'ai entendu: " + input + ". Comment peux-je t'aider?";
        }

        updateStatus("En ligne");
        addMessage(response, 'eva');
        speak(response);

    }, 500);
}

sendButton.addEventListener('click', () => processInput(chatInput.value));
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') processInput(chatInput.value);
});

function updateStatus(text) {
    const status = document.getElementById('eva-status');
    if (status) status.textContent = text;
}

// Synthèse vocale
const synth = window.speechSynthesis;
let voices = [];
let ttsEnabled = true;

const ttsToggleBtn = document.getElementById('tts-toggle');
if (ttsToggleBtn) {
    ttsToggleBtn.addEventListener('click', () => {
        ttsEnabled = !ttsEnabled;
        ttsToggleBtn.textContent = ttsEnabled ? '🔊' : '🔇';
    });
}

function populateVoiceList() {
    voices = synth.getVoices();
}

populateVoiceList();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

function speak(text) {
    if (!ttsEnabled || synth.speaking) return;

    const utterThis = new SpeechSynthesisUtterance(text);
    
    const preferredVoices = voices.filter(v => 
        (v.lang.startsWith('fr') || v.lang.startsWith('fr-'))
    );
    
    if (preferredVoices.length > 0) {
        utterThis.voice = preferredVoices[0];
    }

    utterThis.pitch = 1.1;
    utterThis.rate = 1.05;
    utterThis.lang = 'fr-FR';

    synth.speak(utterThis);
}

// Démarrage
window.addEventListener('DOMContentLoaded', () => {
    console.log("Page chargée, initialisation de Live2D...");
    setTimeout(initLive2D, 500);
});
