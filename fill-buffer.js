module.exports = function fillBuffer(state, buf) {
	var bytesLeft = state.buffer.length - state.index
	var bytesCopied = Math.min(buf.length, bytesLeft)
	buf.copy(state.buffer, state.index, 0, bytesCopied)
	state.rest = buf.slice(bytesCopied)
	state.index += bytesCopied
	return state.index === state.buffer.length
}
