
function LoadingAnimation() {
    return (
        <div className="flex gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
        </div>
    )
}

export default LoadingAnimation