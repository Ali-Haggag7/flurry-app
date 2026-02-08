import { useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";

const PollMessage = ({ message, currentUserId, onVote, t }) => {
    const { poll } = message;
    const senderId = message.sender._id || message.sender;
    const isMe = String(senderId) === String(currentUserId);

    const pollStats = useMemo(() => {
        const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);
        return poll.options.map((opt, index) => {
            const isVotedByMe = opt.votes.includes(currentUserId);
            const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
            return { ...opt, index, percentage, isVotedByMe };
        });
    }, [poll, currentUserId]);

    const totalVotesDisplay = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);

    return (
        <div className="min-w-65 sm:min-w-[320px] pt-1 pb-2">

            <h3 className={`font-bold text-base mb-4 px-1 leading-snug ${isMe ? "text-white" : "text-content"}`}>
                {poll.question}
            </h3>

            <div className="space-y-2.5">
                {pollStats.map((opt) => (
                    <button
                        key={opt.index}
                        onClick={(e) => {
                            e.stopPropagation();
                            onVote(message._id, opt.index);
                        }}
                        disabled={message.isSending}
                        className={`relative w-full overflow-hidden rounded-xl border p-0 transition-all group
                        ${isMe
                                ? "border-white/20 bg-black/10 hover:bg-black/20"
                                : "border-adaptive/60 bg-surface hover:bg-surface-variant"
                            }`}
                    >
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${opt.percentage}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`absolute inset-y-0 start-0 h-full transition-colors duration-300
                            ${isMe
                                    ? "bg-white/25"
                                    : opt.isVotedByMe ? "bg-primary/15" : "bg-adaptive"
                                }`}
                        />

                        <div className="relative flex items-center justify-between px-3.5 py-3 z-10">
                            <div className="flex items-center gap-3">
                                {opt.isVotedByMe ? (
                                    <CheckCircle2 size={20} className={isMe ? "text-white" : "text-primary"} strokeWidth={2.5} />
                                ) : (
                                    <Circle size={20} className={`transition-colors ${isMe ? "text-white/60 group-hover:text-white" : "text-muted group-hover:text-content"}`} />
                                )}

                                <span className={`text-sm font-medium ${isMe ? "text-white" : "text-content"}`}>
                                    {opt.text}
                                </span>
                            </div>
                            <span className={`text-xs font-bold ${isMe ? "text-white/90" : "text-muted"}`}>
                                {opt.percentage}%
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            {/* 🟢 Footer Translated */}
            <div className={`mt-4 px-1 flex justify-between items-center text-[11px] font-medium ${isMe ? "text-white/70" : "text-muted"}`}>
                <span>{totalVotesDisplay} {totalVotesDisplay === 1 ? t("polls.vote") : t("polls.votes")}</span>
                <span>{poll.allowMultipleAnswers ? t("polls.multipleChoice") : t("polls.singleChoice")}</span>
            </div>
        </div>
    );
};

export default PollMessage;