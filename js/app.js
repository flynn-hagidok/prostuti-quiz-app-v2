"use strict";

// ================================
// CONFIGURATION
// ================================

const QUESTION_SECONDS = 20;
const QUIZ_SIZE = 10;

const KEYS = {
    history: "prostutiQuizHistory",
    mistakes: "prostutiMistakes",
    high: "prostutiHighScore"
};

const SUBJECTS = ["HTML", "CSS", "JavaScript"];

const $ = (id) => document.getElementById(id);

const pages = ["home", "quiz", "result", "history", "mistakes"];

// ================================
// QUIZ STATE
// ================================

let questionBank = [];
let quizQuestions = [];
let currentIndex = 0;
let answers = [];

let secondsLeft = QUESTION_SECONDS;
let timerId = null;
let answerLocked = false;

let currentMode = "normal";
let chosenSubject = "";
let chosenDifficulty = "";

let chartInstance = null;

// ================================
// LOCAL STORAGE
// ================================

function getStoredArray(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getHistory() {
    return getStoredArray(KEYS.history);
}

function getMistakes() {
    return getStoredArray(KEYS.mistakes);
}

function getHighScore() {
    return Number(localStorage.getItem(KEYS.high)) || 0;
}

function refreshHighScore() {
    $("highScore").textContent = `${getHighScore()}%`;
}

// ================================
// SHUFFLE ARRAY
// ================================

function shuffle(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

// ================================
// PAGE NAVIGATION
// ================================

function showPage(page) {
    if (!pages.includes(page)) return;

    if (page !== "quiz") {
        stopTimer();
    }

    pages.forEach((name) => {
        $(`${name}Page`).classList.toggle("hidden", name !== page);
    });

    document.querySelectorAll("[data-page]").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    if (page === "history") renderHistory();
    if (page === "mistakes") renderMistakes();

    window.scrollTo(0, 0);
}

// ================================
// FETCH QUESTIONS
// ================================

async function loadQuestions() {
    const response = await fetch("./data/questions.json");

    if (!response.ok) {
        throw new Error(
            `Questions could not be loaded (${response.status}).`
        );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Invalid questions.json format.");
    }

    questionBank = data;
}

// ================================
// HOME VALIDATION
// ================================

function showHomeError(message) {
    $("homeError").textContent = message;
    $("homeError").classList.remove("hidden");
}

function hideHomeError() {
    $("homeError").classList.add("hidden");
}

// ================================
// START NORMAL QUIZ
// ================================

async function startNormalQuiz() {
    hideHomeError();

    const subject = $("subjectSelect").value;
    const difficulty = $("difficultySelect").value;

    if (!subject || !difficulty) {
        showHomeError(
            "Please select both a subject and a difficulty."
        );
        return;
    }

    try {
        if (!questionBank.length) {
            await loadQuestions();
        }
    } catch (error) {
        showHomeError(
            `${error.message} Use Live Server instead of opening the HTML file directly.`
        );
        return;
    }

    const pool = questionBank.filter(
        (q) =>
            q.subject === subject &&
            q.difficulty === difficulty
    );

    if (pool.length < QUIZ_SIZE) {
        showHomeError(
            `Only ${pool.length} questions available. At least ${QUIZ_SIZE} are required.`
        );
        return;
    }

    chosenSubject = subject;
    chosenDifficulty = difficulty;

    beginQuiz(
        shuffle(pool).slice(0, QUIZ_SIZE),
        "normal"
    );
}

// ================================
// INITIALIZE QUIZ
// ================================

function beginQuiz(selectedQuestions, mode) {
    if (!selectedQuestions.length) return;

    stopTimer();

    currentMode = mode;

    quizQuestions = selectedQuestions.map((q) => ({
        ...q,
        options: shuffle(q.options)
    }));

    currentIndex = 0;
    answers = [];

    showPage("quiz");
    displayQuestion();
}

// ================================
// DISPLAY QUESTION
// ================================

function displayQuestion() {
    stopTimer();

    answerLocked = false;

    const question = quizQuestions[currentIndex];

    $("quizLabel").textContent =
        currentMode === "mistakes"
            ? "Mistake Practice"
            : `${chosenSubject} · ${capitalize(chosenDifficulty)}`;

    $("currentQuestion").textContent = currentIndex + 1;

    $("totalQuestions").textContent = quizQuestions.length;

    $("progressBar").style.width =
        `${(currentIndex / quizQuestions.length) * 100}%`;

    $("questionText").textContent = question.question;

    $("optionsContainer").replaceChildren();

    question.options.forEach((option) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "option-btn";
        button.textContent = option;

        button.addEventListener("click", () => {
            selectAnswer(option);
        });

        $("optionsContainer").appendChild(button);
    });

    startTimer();
}

// ================================
// TIMER
// ================================

function startTimer() {
    secondsLeft = QUESTION_SECONDS;

    updateTimer();

    timerId = window.setInterval(() => {
        secondsLeft--;

        updateTimer();

        if (secondsLeft <= 0) {
            selectAnswer(null);
        }
    }, 1000);
}

function updateTimer() {
    $("timer").textContent = secondsLeft;

    $("timerBox").classList.toggle(
        "warning",
        secondsLeft <= 5
    );
}

function stopTimer() {
    if (timerId !== null) {
        window.clearInterval(timerId);
    }

    timerId = null;
}

// ================================
// ANSWER SELECTION
// ================================

function selectAnswer(selected) {
    if (answerLocked) return;

    answerLocked = true;
    stopTimer();

    const question = quizQuestions[currentIndex];

    const correct = selected === question.correctAnswer;

    answers.push({
        questionId: question.id,
        selected,
        correct,
        question
    });

    $("optionsContainer")
        .querySelectorAll("button")
        .forEach((button) => {
            button.disabled = true;

            if (button.textContent === question.correctAnswer) {
                button.classList.add("correct");
            } else if (
                selected !== null &&
                button.textContent === selected
            ) {
                button.classList.add("incorrect");
            }
        });

    window.setTimeout(() => {
        currentIndex++;

        if (currentIndex < quizQuestions.length) {
            displayQuestion();
        } else {
            finishQuiz();
        }
    }, 550);
}

// ================================
// FINISH QUIZ
// ================================

function finishQuiz() {
    stopTimer();

    const correctCount = answers.filter(
        (answer) => answer.correct
    ).length;

    const wrongCount = answers.length - correctCount;

    const percent = Math.round(
        (correctCount / quizQuestions.length) * 100
    );

    // Save normal quiz history
    if (currentMode === "normal") {
        const history = getHistory();

        history.push({
            id:
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random()}`,

            date: new Date().toISOString(),
            subject: chosenSubject,
            difficulty: chosenDifficulty,
            score: percent,
            totalQuestions: quizQuestions.length,
            correctAnswers: correctCount,
            wrongAnswers: wrongCount
        });

        saveArray(KEYS.history, history);

        if (percent > getHighScore()) {
            localStorage.setItem(
                KEYS.high,
                String(percent)
            );
        }
    }

    // Save incorrect questions
    const mistakeMap = new Map(
        getMistakes().map((item) => [
            String(item.questionId),
            item
        ])
    );

    answers.forEach(({ questionId, correct, question }) => {
        if (correct) {
            mistakeMap.delete(String(questionId));
        } else {
            mistakeMap.set(String(questionId), {
                questionId,
                subject: question.subject,
                difficulty: question.difficulty
            });
        }
    });

    saveArray(
        KEYS.mistakes,
        [...mistakeMap.values()]
    );

    $("resultSubtitle").textContent =
        currentMode === "mistakes"
            ? "Mistake practice finished (not added to history)."
            : `${chosenSubject} · ${capitalize(chosenDifficulty)}`;

    $("finalScore").textContent = `${percent}%`;
    $("correctCount").textContent = correctCount;
    $("wrongCount").textContent = wrongCount;

    $("resultHighScore").textContent =
        `${getHighScore()}%`;

    refreshHighScore();
    renderAnswerReview();
    showPage("result");
}

// ================================
// ANSWER REVIEW
// ================================

function renderAnswerReview() {
    const container = $("answerReview");

    container.replaceChildren();

    answers.forEach((answer, index) => {
        const card = document.createElement("article");

        card.className =
            `review-item ${answer.correct ? "correct" : "wrong"}`;

        const title = document.createElement("strong");

        title.textContent =
            `${index + 1}. ${answer.question.question}`;

        const selected = document.createElement("p");

        selected.className =
            answer.correct ? "text-good" : "text-bad";

        selected.textContent =
            `Your answer: ${answer.selected ?? "Time expired / Unanswered"}`;

        const correct = document.createElement("p");

        correct.className = "text-good";

        correct.textContent =
            `Correct answer: ${answer.question.correctAnswer}`;

        card.append(title, selected, correct);

        container.appendChild(card);
    });
}

// ================================
// HELPER FUNCTIONS
// ================================

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(iso) {
    const date = new Date(iso);

    return Number.isNaN(date.getTime())
        ? "Unknown"
        : date.toLocaleString();
}

function makeCell(row, text) {
    const cell = document.createElement("td");

    cell.textContent = text;

    row.appendChild(cell);
}

// ================================
// HISTORY
// ================================

function renderHistory() {
    const history = getHistory();

    const scores = history.map(
        (item) => Number(item.score) || 0
    );

    $("totalQuizStat").textContent = history.length;

    $("bestScoreStat").textContent =
        `${scores.length ? Math.max(...scores) : 0}%`;

    $("averageScoreStat").textContent =
        `${scores.length
            ? Math.round(
                scores.reduce((a, b) => a + b, 0) /
                scores.length
            )
            : 0
        }%`;

    const tbody = $("historyTableBody");

    tbody.replaceChildren();

    if (!history.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.className = "empty";

        cell.textContent =
            "No quiz attempts yet. Complete your first quiz!";

        row.appendChild(cell);
        tbody.appendChild(row);
    } else {
        [...history].reverse().forEach((attempt) => {
            const row = document.createElement("tr");

            makeCell(row, formatDate(attempt.date));
            makeCell(row, attempt.subject);

            makeCell(
                row,
                capitalize(attempt.difficulty || "easy")
            );

            makeCell(row, `${attempt.score}%`);

            tbody.appendChild(row);
        });
    }

    renderAverages(history);
    renderScoreChart(history);
}

// ================================
// SUBJECT AVERAGES
// ================================

function renderAverages(history) {
    const container = $("subjectAverages");

    container.replaceChildren();

    SUBJECTS.forEach((subject) => {
        const values = history
            .filter((attempt) => attempt.subject === subject)
            .map((attempt) => Number(attempt.score) || 0);

        const average = values.length
            ? Math.round(
                values.reduce((a, b) => a + b, 0) /
                values.length
            )
            : 0;

        const item = document.createElement("div");

        const head = document.createElement("div");
        head.className = "avg-head";

        const name = document.createElement("span");
        name.textContent = subject;

        const value = document.createElement("span");

        value.textContent = values.length
            ? `${average}%`
            : "No attempts";

        head.append(name, value);

        const track = document.createElement("div");
        track.className = "avg-track";

        const fill = document.createElement("div");
        fill.className = "avg-fill";

        fill.style.width = `${average}%`;

        track.appendChild(fill);
        item.append(head, track);

        container.appendChild(item);
    });
}

// ================================
// CHART.JS
// ================================

function renderScoreChart(history) {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    const fallback = $("chartFallback");

    fallback.classList.toggle(
        "hidden",
        typeof window.Chart !== "undefined"
    );

    if (typeof window.Chart === "undefined") {
        return;
    }

    const context = $("scoreChart").getContext("2d");

    chartInstance = new window.Chart(context, {
        type: "line",

        data: {
            labels: history.map(
                (_, index) => `Quiz ${index + 1}`
            ),

            datasets: [
                {
                    label: "Score (%)",

                    data: history.map(
                        (attempt) => attempt.score
                    ),

                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37,99,235,.12)",
                    tension: 0.25,
                    fill: true,
                    pointRadius: 4
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                y: {
                    min: 0,
                    max: 100,

                    ticks: {
                        callback: (value) => `${value}%`
                    }
                }
            },

            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// ================================
// CLEAR HISTORY
// ================================

function clearHistory() {
    if (!getHistory().length) return;

    const confirmed = window.confirm(
        "Delete all quiz history? Your saved mistakes will remain."
    );

    if (!confirmed) return;

    localStorage.removeItem(KEYS.history);

    renderHistory();
}

// ================================
// MISTAKE REVIEW
// ================================

function renderMistakes() {
    const mistakes = getMistakes();

    $("totalMistakes").textContent = mistakes.length;

    $("practiceMistakesBtn").disabled =
        mistakes.length === 0;

    const summary = $("mistakeSummary");

    summary.replaceChildren();

    SUBJECTS.forEach((subject) => {
        const row = document.createElement("div");
        row.className = "mistake-row";

        const label = document.createElement("strong");
        label.textContent = subject;

        const count = document.createElement("span");

        count.textContent =
            `${mistakes.filter(
                (item) => item.subject === subject
            ).length
            } questions`;

        row.append(label, count);

        summary.appendChild(row);
    });
}

// ================================
// PRACTICE WRONG QUESTIONS
// ================================

async function practiceMistakes() {
    try {
        if (!questionBank.length) {
            await loadQuestions();
        }

        const ids = new Set(
            getMistakes().map(
                (item) => String(item.questionId)
            )
        );

        const pool = questionBank.filter(
            (question) => ids.has(String(question.id))
        );

        if (!pool.length) {
            window.alert("No saved mistakes to practice.");
            renderMistakes();
            return;
        }

        beginQuiz(
            shuffle(pool),
            "mistakes"
        );
    } catch (error) {
        window.alert(error.message);
    }
}

// ================================
// INITIALIZE APPLICATION
// ================================

function init() {
    document
        .querySelectorAll("[data-page]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                showPage(button.dataset.page);
            });
        });

    $("logoLink").addEventListener("click", (event) => {
        event.preventDefault();
        showPage("home");
    });

    $("startQuizBtn").addEventListener(
        "click",
        startNormalQuiz
    );

    $("restartQuizBtn").addEventListener("click", () => {
        showPage("home");
    });

    $("resultHistoryBtn").addEventListener("click", () => {
        showPage("history");
    });

    $("clearHistoryBtn").addEventListener(
        "click",
        clearHistory
    );

    $("practiceMistakesBtn").addEventListener(
        "click",
        practiceMistakes
    );

    refreshHighScore();

    loadQuestions().catch((error) => {
        showHomeError(
            `${error.message} Run this project with Live Server.`
        );
    });
}

document.addEventListener("DOMContentLoaded", init);