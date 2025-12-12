$(document).ready(function () {

    // Load navbar
    $("#navbar-container").load("navbar.html");

    // --- State Variables ---
    let questionsById = new Map(); // Map to store questions by their ID
    let shuffledQuestionIds = [];  // Array to store the shuffled order of question IDs
    let choicesById = {};          // Object to store user choices, keyed by question ID
    let current_question = 0;      // Index of the current question in the shuffledQuestionIds array

    // --- Quiz State Manager ---
    const QuizStateManager = {
        STORAGE_KEY: 'quizState_v2', // Use a new key to avoid conflicts with old format

        loadState: function() {
            const savedState = localStorage.getItem(this.STORAGE_KEY);
            let state = null;
            if (savedState) {
                try {
                    state = JSON.parse(savedState);
                    // Basic structure validation
                    if (!state || !Array.isArray(state.shuffledQuestionIds) || typeof state.choicesById !== 'object' || state.choicesById === null || typeof state.currentQuestionIndex !== 'number') {
                        console.warn("Invalid saved state structure found, clearing state and starting fresh.");
                        this.clearState(); // 清除无效状态
                        return null;
                    }

                    // Advanced Validation: Check if IDs are still valid and index is within bounds
                    // Ensure questionsById is populated before calling this
                    if (questionsById.size === 0) {
                        console.error("State loading error: questionsById map is empty. Cannot validate saved IDs.");
                        return null; // Cannot proceed without question data
                    }

                    const validIds = state.shuffledQuestionIds.filter(id => questionsById.has(id));
                    if (validIds.length !== state.shuffledQuestionIds.length) {
                        console.warn("Some saved question IDs are no longer valid. Filtering them out.");
                        state.shuffledQuestionIds = validIds;
                        // Clean up choices for invalid IDs
                        Object.keys(state.choicesById).forEach(id => {
                            if (!validIds.includes(id)) {
                                delete state.choicesById[id];
                            }
                        });
                    }

                    // Check if the array is now empty after filtering
                    if (state.shuffledQuestionIds.length === 0) {
                         console.warn("No valid questions left in saved state after filtering. Clearing state and starting fresh.");
                         this.clearState(); // 清除无效状态
                         return null;
                    }

                    // Validate current index
                    if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= state.shuffledQuestionIds.length) {
                        console.warn(`Saved current question index ${state.currentQuestionIndex} out of bounds (max: ${state.shuffledQuestionIds.length - 1}), resetting to 0.`);
                        state.currentQuestionIndex = 0;
                        // 索引无效，也视为需要重新开始
                        this.clearState();
                        return null;
                    }

                    // *** 新增检查：如果加载的状态已经是最后一个问题或之后，则视为已完成 ***
                    if (state.shuffledQuestionIds.length > 0 && state.currentQuestionIndex >= state.shuffledQuestionIds.length - 1) {
                        console.log(`Loaded state indicates quiz was likely completed (index ${state.currentQuestionIndex} of ${state.shuffledQuestionIds.length}). Clearing state and starting fresh.`);
                        this.clearState(); // 清除已完成的状态
                        return null; // 返回 null 以便开始新测验
                    }

                    console.log("Restoring saved quiz state (ID-based).");
                    return state;

                } catch (e) {
                    console.error("Error parsing saved state:", e);
                    this.clearState(); // 清除损坏的状态
                    return null; // Discard corrupted state
                }
            }
            return null; // No saved state found
        },

        saveState: function(stateData) {
            // Ensure stateData is provided and has the correct structure
             if (!stateData || !Array.isArray(stateData.shuffledQuestionIds) || typeof stateData.choicesById !== 'object' || stateData.choicesById === null || typeof stateData.currentQuestionIndex !== 'number') {
                 console.error("Attempted to save invalid state data structure.", stateData);
                 return;
             }
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateData));
                // console.log("Quiz state saved (ID-based)."); // Optional: less verbose logging
            } catch (e) {
                console.error("Error saving quiz state to localStorage:", e);
                // Handle potential storage errors (e.g., quota exceeded)
            }
        },

        clearState: function() {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log("Quiz state cleared (ID-based).");
        },

        getCurrentState: function() {
             return {
                 shuffledQuestionIds: shuffledQuestionIds,
                 choicesById: choicesById,
                 currentQuestionIndex: current_question
             };
        }
    };

    // --- Data Preprocessing ---
    let initializationError = false;
    // Ensure 'questions' is defined (loaded from info/questions.js)
    if (typeof questions === 'undefined' || !Array.isArray(questions)) {
        console.error("Initialization Error: Global 'questions' array not found or invalid.");
        initializationError = true;
    } else {
        questions.forEach(q => {
            if (q.id === undefined || q.id === null) {
                console.error("Initialization Error: Question missing ID.", q);
                initializationError = true;
                return; // Skip this question
            }
            if (questionsById.has(q.id)) {
                console.error("Initialization Error: Duplicate question ID found:", q.id);
                initializationError = true;
                // Decide how to handle duplicates, e.g., keep the first one encountered
                return;
            }
            questionsById.set(q.id, q);
        });
    }

    if (initializationError || questionsById.size === 0) {
         // Handle critical initialization errors, e.g., show an error message to the user
         $("#question-text").html("错误：测验题目数据初始化失败，请检查题目文件并确保题目 ID 正确无误。");
         $("#question-number").html("");
         $(".button-footer").hide(); // Hide buttons if initialization fails
         return; // Stop further execution
    }

    // --- State Initialization ---
    // Load state *after* questionsById is populated
    const loadedState = QuizStateManager.loadState();

    if (loadedState) {
        // Restore state
        shuffledQuestionIds = loadedState.shuffledQuestionIds;
        choicesById = loadedState.choicesById;
        current_question = loadedState.currentQuestionIndex;
    } else {
        // No valid saved state, or state was cleared because it represented a completed quiz. Start fresh.
        console.log("Starting a new quiz session (ID-based).");
        // 确保在开始新会话前清除任何可能存在的旧状态（即使 loadState 内部已处理，这里再确认一次）
        QuizStateManager.clearState(); // <-- 确保清除
        const allIds = Array.from(questionsById.keys());
        shuffledQuestionIds = allIds.sort(() => Math.random() - 0.5); // Shuffle IDs
        choicesById = {}; // Initialize empty choices
        current_question = 0;
        // Save the initial state only if there are questions
        if (shuffledQuestionIds.length > 0) {
             QuizStateManager.saveState(QuizStateManager.getCurrentState());
        } else {
             console.warn("No questions available to start a new quiz.");
        }
    }

    // --- Core Quiz Functions ---

    function render_question() {
        if (shuffledQuestionIds.length === 0) {
             $("#question-text").html("错误：没有可显示的题目。");
             $("#question-number").html("");
             $("#btn-prev").prop('disabled', true);
             $(".button-footer").hide();
             return;
        }
        // Ensure current_question index is valid
        if (current_question >= 0 && current_question < shuffledQuestionIds.length) {
            const currentId = shuffledQuestionIds[current_question];
            const questionData = questionsById.get(currentId);

            if (questionData) {
                $("#question-text").html(questionData.question);
                $("#question-number").html(`第 ${current_question + 1} 题 / 共 ${shuffledQuestionIds.length} 题`);
                $("#btn-prev").prop('disabled', current_question === 0);
            } else {
                 console.error("Error rendering: Question data not found for ID:", currentId);
                 // Handle missing question data, maybe skip to the next valid one?
                 // For now, show an error.
                 $("#question-text").html(`错误：无法加载题目 (ID: ${currentId})。`);
                 $("#question-number").html("");
                 $("#btn-prev").prop('disabled', true); // Disable prev if current is broken
            }
        } else {
             console.error("Invalid current_question index:", current_question);
             // Attempt to recover or show error
             current_question = 0; // Reset to first question as a fallback
             if (shuffledQuestionIds.length > 0) {
                 render_question(); // Re-render with corrected index
             } else {
                 // This case should be caught earlier, but as a safeguard:
                 $("#question-text").html("错误：没有题目可显示。");
                 $("#question-number").html("");
                 $("#btn-prev").prop('disabled', true);
             }
        }
    }

    function next_question() {
        if (current_question < shuffledQuestionIds.length - 1) {
            current_question++;
            render_question();
            QuizStateManager.saveState(QuizStateManager.getCurrentState()); // Save progress after moving
        } else {
            // Before calculating results, ensure the last choice is potentially saved if needed
            // (though saveOnExit should cover most cases)
            QuizStateManager.saveState(QuizStateManager.getCurrentState());
            results();
        }
    }

    function prev_question() {
        if (current_question > 0) {
            current_question--;
            render_question();
            QuizStateManager.saveState(QuizStateManager.getCurrentState()); // Save progress after moving
        }
    }

    function results() {
        QuizStateManager.clearState(); // Clear saved state before showing results

        // Ensure 'axes' is defined (loaded from info/axes.js)
        if (typeof axes === 'undefined' || !Array.isArray(axes)) {
             console.error("Error calculating results: Global 'axes' array not found or invalid.");
             $("#question-text").html("错误：无法计算结果，坐标轴数据丢失。");
             return;
        }

        let scores = {};
        axes.forEach(axis => { scores[axis.id] = 0; });
        let maxScores = {};
        axes.forEach(axis => { maxScores[axis.id] = 0; });

        // Calculate scores based on shuffled order and choicesById
        shuffledQuestionIds.forEach(questionId => {
            const questionData = questionsById.get(questionId);
            if (!questionData) {
                console.warn(`Skipping score calculation for missing question ID: ${questionId}`);
                return; // Skip if question data is missing
            }

            const choice = choicesById[questionId] !== undefined ? choicesById[questionId] : 0; // Get choice by ID, default 0

            // Calculate score effect
            for (let axisId in questionData.effect) {
                if (scores.hasOwnProperty(axisId)) { // Ensure the axis exists in scores
                    const effectValue = questionData.effect[axisId];
                    scores[axisId] += choice * effectValue;
                } else {
                     console.warn(`Effect found for unknown axis '${axisId}' in question '${questionId}'`);
                }
            }

            // Calculate max possible score for normalization
            // Assuming max absolute choice value is 1.0 (strongly agree/disagree)
            for (let axisId in questionData.effect) {
                 if (maxScores.hasOwnProperty(axisId)) {
                     const effectValue = (questionData.effect && typeof questionData.effect[axisId] === 'number') ? questionData.effect[axisId] : 0;
                     // Max score is based on the maximum possible absolute effect * max absolute choice (which is 1)
                     maxScores[axisId] += Math.abs(effectValue);
                 }
            }
        });


        // Normalize scores to a range of -10 to 10
        for (let axisId in scores) {
            if (maxScores[axisId] !== 0) {
                // Normalize based on the sum of absolute effects for that axis
                scores[axisId] = (scores[axisId] / maxScores[axisId]) * 10;
                // Round to one decimal place
                scores[axisId] = Math.round(scores[axisId] * 10) / 10;
            } else {
                scores[axisId] = 0; // Avoid division by zero if maxScore is 0
            }
        }

        // Redirect to results page with scores in URL hash
        const validScores = {};
        for (const key in scores) {
            if (Object.hasOwnProperty.call(scores, key) && typeof scores[key] === 'number' && !isNaN(scores[key])) {
                validScores[key] = scores[key];
            } else {
                 console.warn(`Invalid score for axis ${key}: ${scores[key]}. Excluding from results.`);
            }
        }
        // Ensure results.html exists and path is correct
        location.href = "results.html#" + new URLSearchParams(validScores).toString();
    }

    // --- Event Handlers ---

    // Unified click handler for answer buttons
    $('.button-row').on('click', 'button[data-choice-value]', function() {
        const choiceValue = parseFloat($(this).data('choice-value'));
        // Ensure we have a valid current question ID
        if (current_question >= 0 && current_question < shuffledQuestionIds.length) {
             const currentId = shuffledQuestionIds[current_question];
             choicesById[currentId] = choiceValue; // Store choice by ID
             // REMOVED saveState call here
             next_question();
        } else {
             console.error("Cannot process choice: Invalid current question index.");
        }
    });

    // Previous button handler
    $("#btn-prev").click(() => {
        prev_question();
        // saveState is now called inside prev_question
    });

    // Save progress on page hide/visibility change
    function saveOnExit() {
         // Check if quiz is still in progress
         if (shuffledQuestionIds && shuffledQuestionIds.length > 0 && current_question < shuffledQuestionIds.length) {
              // Also check if we are actually on the quiz page, not results page
              // (A simple check might be if the results container is hidden, or based on URL)
              // For now, assume if we have state variables, we are in progress.
              console.log('Page is hiding/unloading, saving progress...');
              QuizStateManager.saveState(QuizStateManager.getCurrentState());
         }
    }
    // Use 'pagehide' for better reliability, especially with bfcache
    window.addEventListener('pagehide', saveOnExit);
    // Use 'visibilitychange' as a fallback or supplement
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            saveOnExit();
        }
    });

    // --- Initial Render ---
    render_question();

});
