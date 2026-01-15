import React, { useState } from 'react';

import { getVideoQuiz, type QuizQuestion } from './auth/authService';

interface QuizPanelProps {
    videoTitle: string;
    videoId: number;
    onClose: () => void;
}

export function QuizPanel({ videoTitle, videoId, onClose }: QuizPanelProps): React.ReactElement {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [isAdExpanded, setIsAdExpanded] = useState(true);
    const [score, setScore] = useState(0);

    React.useEffect(() => {
        const loadQuiz = async () => {
            setLoading(true);
            try {
                // Check localStorage first
                const stored = localStorage.getItem(`credlyse_quiz_${videoId}`);
                if (stored) {
                    setQuestions(JSON.parse(stored));
                    setLoading(false);
                    return;
                }

                const quizData = await getVideoQuiz(videoId);
                if (quizData && quizData.questions) {
                    setQuestions(quizData.questions);
                    // Store in localStorage
                    localStorage.setItem(`credlyse_quiz_${videoId}`, JSON.stringify(quizData.questions));
                }
            } catch (error) {
                console.error("Failed to load quiz", error);
            } finally {
                setLoading(false);
            }
        };
        loadQuiz();
    }, [videoId]);

    const handleAnswerSelect = (index: number) => {
        if (showResult) return;
        setSelectedAnswer(index);
    };

    const handleSubmit = () => {
        if (selectedAnswer === null) return;

        const currentQ = questions[currentQuestion];
        const selectedOption = currentQ.options[selectedAnswer];

        if (selectedOption === currentQ.answer) {
            setScore(score + 1);
        }
        setShowResult(true);
    };

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowResult(false);
        }
    };

    if (loading) {
        return (
            <div className="quiz-panel-overlay">
                <div className="quiz-panel">
                    <div className="quiz-header">
                        <h2>Loading Quiz...</h2>
                        <button className="quiz-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="quiz-panel-overlay">
                <div className="quiz-panel">
                    <div className="quiz-header">
                        <h2>No quiz available</h2>
                        <button className="quiz-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>
            </div>
        );
    }

    const isLastQuestion = currentQuestion === questions.length - 1;
    const currentQ = questions[currentQuestion];
    const isCorrect = selectedAnswer !== null && currentQ.options[selectedAnswer] === currentQ.answer;

    const renderSummary = () => (
        <div className="quiz-panel">
            <div className="quiz-header">
                <h2>Quiz Complete!</h2>
                <button className="quiz-close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="quiz-summary-content">
                <div className="quiz-final-score">
                    <span className="score-label">Your Score</span>
                    <span className="score-value">{score}/{questions.length}</span>
                </div>

                <div className="sponsored-ad-card">
                    <div className="ad-banner"></div>
                    <div className="ad-header" onClick={() => setIsAdExpanded(!isAdExpanded)}>
                        <div className="ad-header-left">
                            <span className="replit-logo-small">R</span>
                            <div className="ad-header-text">
                                <span className="ad-title">Automatic software creator</span>
                                <span className="ad-subtitle">Sponsored • replit.com</span>
                            </div>
                        </div>
                        <button className={`ad-expand-btn ${isAdExpanded ? 'expanded' : ''}`}>
                            ▼
                        </button>
                    </div>

                    {isAdExpanded && (
                        <div className="ad-expanded-content">
                            <div className="ad-links-list">
                                <a href="https://replit.com/gallery" target="_blank" rel="noopener noreferrer" className="ad-link-item">
                                    <span className="ad-link-title">Replit Gallery</span>
                                    <span className="ad-link-desc">Get inspired by these neat ideas Boost your productivity</span>
                                </a>
                                <a href="https://replit.com/ai" target="_blank" rel="noopener noreferrer" className="ad-link-item">
                                    <span className="ad-link-title">AI Software Creator</span>
                                    <span className="ad-link-desc">Make apps with natural language AI makes ...</span>
                                    <span className="ad-link-arrow">↗</span>
                                </a>
                                <a href="https://replit.com" target="_blank" rel="noopener noreferrer" className="ad-link-item">
                                    <span className="ad-link-title">Replit</span>
                                    <span className="ad-link-desc">AI Builds It Automatically for You AI creates ...</span>
                                </a>
                                <a href="https://replit.com/pricing" target="_blank" rel="noopener noreferrer" className="ad-link-item">
                                    <span className="ad-link-title">Pricing</span>
                                    <span className="ad-link-desc">Build, deploy, and scale fast Get started now</span>
                                </a>
                            </div>

                            <a href="https://replit.com" target="_blank" rel="noopener noreferrer" className="ad-visit-btn">
                                Visit site
                            </a>
                        </div>
                    )}
                </div>
                <div className="ad-disclaimer">
                    Promoted by extension, not affiliated with YouTube or the creator
                </div>
            </div>
        </div>
    );

    return (
        <div className="quiz-panel-overlay">
            {showSummary ? renderSummary() : (
                <div className="quiz-panel">
                    <div className="quiz-header">
                        <div className="quiz-header-left">
                            <span className="quiz-icon">📝</span>
                            <h2>Quiz: {videoTitle}</h2>
                        </div>
                        <button className="quiz-close-btn" onClick={onClose}>✕</button>
                    </div>

                    <div className="quiz-progress">
                        <div className="quiz-progress-text">
                            Question {currentQuestion + 1} of {questions.length}
                        </div>
                        <div className="quiz-progress-bar">
                            <div
                                className="quiz-progress-fill"
                                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    <div className="quiz-content">
                        <h3 className="quiz-question">{questions[currentQuestion].q}</h3>

                        <div className="quiz-options">
                            {questions[currentQuestion].options.map((option, index) => (
                                <button
                                    key={index}
                                    className={`quiz-option ${selectedAnswer === index ? 'selected' : ''} ${showResult
                                        ? option === questions[currentQuestion].answer
                                            ? 'correct'
                                            : selectedAnswer === index
                                                ? 'incorrect'
                                                : ''
                                        : ''
                                        }`}
                                    onClick={() => handleAnswerSelect(index)}
                                    disabled={showResult}
                                >
                                    <span className="quiz-option-letter">{String.fromCharCode(65 + index)}</span>
                                    <span className="quiz-option-text">{option}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {showResult && (
                        <div className={`quiz-result ${isCorrect ? 'correct' : 'incorrect'}`}>
                            {isCorrect ? '✓ Correct!' : '✗ Incorrect. The correct answer is highlighted.'}
                        </div>
                    )}

                    <div className="quiz-actions">
                        {!showResult ? (
                            <button
                                className="quiz-submit-btn"
                                onClick={handleSubmit}
                                disabled={selectedAnswer === null}
                            >
                                Submit Answer
                            </button>
                        ) : isLastQuestion ? (
                            <div className="quiz-complete">
                                <button className="quiz-finish-btn" onClick={() => setShowSummary(true)}>
                                    View Results
                                </button>
                            </div>
                        ) : (
                            <button className="quiz-next-btn" onClick={handleNext}>
                                Next Question →
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
