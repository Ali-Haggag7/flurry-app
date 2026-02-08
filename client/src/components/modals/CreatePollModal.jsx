import { useState } from "react";
import { X, Plus, Trash2, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const CreatePollModal = ({ isOpen, onClose, onSubmit }) => {
    const { t } = useTranslation();

    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", ""]);
    const [allowMultiple, setAllowMultiple] = useState(false);

    if (!isOpen) return null;

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        if (options.length < 5) setOptions([...options, ""]);
    };

    const removeOption = (index) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const validOptions = options.filter(o => o.trim() !== "");
        if (!question.trim() || validOptions.length < 2) return;

        onSubmit({ question, options: validOptions, allowMultipleAnswers: allowMultiple });
        // Reset
        setQuestion("");
        setOptions(["", ""]);
        setAllowMultiple(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-surface border border-adaptive w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-adaptive bg-main/50">
                    <h3 className="font-bold flex items-center gap-2 text-content">
                        <BarChart2 className="text-primary" size={20} /> {t("polls.createTitle")}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded-full transition"><X size={20} /></button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto space-y-4">
                    <div>
                        <label className="text-xs font-bold text-muted uppercase mb-1 block">{t("polls.questionLabel")}</label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={t("polls.questionPlaceholder")}
                            className="w-full bg-main border border-adaptive rounded-xl px-3 py-2.5 focus:border-primary outline-none transition text-content placeholder-muted"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted uppercase mb-1 block">{t("polls.optionsLabel")}</label>
                        {options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleOptionChange(i, e.target.value)}
                                    placeholder={`${t("polls.optionPlaceholder")} ${i + 1}`}
                                    className="flex-1 bg-main border border-adaptive rounded-xl px-3 py-2 focus:border-primary outline-none transition text-sm text-content placeholder-muted"
                                />
                                {options.length > 2 && (
                                    <button onClick={() => removeOption(i)} className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"><Trash2 size={16} /></button>
                                )}
                            </div>
                        ))}
                        {options.length < 5 && (
                            <button onClick={addOption} className="flex items-center gap-2 text-primary text-sm font-medium hover:bg-primary/10 px-3 py-2 rounded-lg transition w-full justify-center border border-dashed border-primary/30 mt-2">
                                <Plus size={16} /> {t("polls.addOption")}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <input
                            type="checkbox"
                            id="multi"
                            checked={allowMultiple}
                            onChange={(e) => setAllowMultiple(e.target.checked)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                        />
                        <label htmlFor="multi" className="text-sm cursor-pointer select-none text-content">{t("polls.allowMultiple")}</label>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-adaptive bg-main/50">
                    <button
                        onClick={handleSubmit}
                        disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t("polls.createButton")}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default CreatePollModal;