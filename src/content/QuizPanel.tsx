import React, { useState } from 'react';

interface Question {
    id: number;
    question: string;
    options: string[];
    correctAnswer: number;
}

interface QuizPanelProps {
    videoTitle: string;
    onClose: () => void;
}

export function QuizPanel({ videoTitle, onClose }: QuizPanelProps): React.ReactElement {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);

    // Demo questions - in real implementation, these would be fetched/generated
    const questions: Question[] = [
        {
            id: 1,
            question: "What is the main concept covered in this video?",
            options: [
                "Machine Learning basics",
                "The topic discussed in the video",
                "Web development",
                "Mobile app development"
            ],
            correctAnswer: 1
        },
        {
            id: 2,
            question: "Which key point was emphasized the most?",
            options: [
                "Speed of implementation",
                "Understanding core concepts",
                "Using specific tools",
                "All of the above"
            ],
            correctAnswer: 3
        },
        {
            id: 3,
            question: "What should you do after watching this video?",
            options: [
                "Just move to next video",
                "Practice what you learned",
                "Forget everything",
                "Skip the playlist"
            ],
            correctAnswer: 1
        }
    ];

    const handleAnswerSelect = (index: number) => {
        if (showResult) return;
        setSelectedAnswer(index);
    };

    const handleSubmit = () => {
        if (selectedAnswer === null) return;

        if (selectedAnswer === questions[currentQuestion].correctAnswer) {
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

    const isLastQuestion = currentQuestion === questions.length - 1;
    const isCorrect = selectedAnswer === questions[currentQuestion].correctAnswer;

    return (
        <div className="quiz-panel-overlay">
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
                    <h3 className="quiz-question">{questions[currentQuestion].question}</h3>

                    <div className="quiz-options">
                        {questions[currentQuestion].options.map((option, index) => (
                            <button
                                key={index}
                                className={`quiz-option ${selectedAnswer === index ? 'selected' : ''} ${showResult
                                        ? index === questions[currentQuestion].correctAnswer
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
                            <span className="quiz-score">Score: {score + (isCorrect ? 1 : 0)}/{questions.length}</span>
                            <button className="quiz-finish-btn" onClick={onClose}>
                                Finish Quiz
                            </button>
                        </div>
                    ) : (
                        <button className="quiz-next-btn" onClick={handleNext}>
                            Next Question →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
