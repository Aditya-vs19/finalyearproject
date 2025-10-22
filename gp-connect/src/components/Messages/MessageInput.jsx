import React, { useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { IoHappyOutline, IoSend } from 'react-icons/io5';

const MessageInput = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);

  const handleEmojiClick = (emojiData) => {
    if (!emojiData?.emoji) {
      return;
    }
    const emoji = emojiData.emoji;
    const element = inputRef.current;
    if (!element) {
      setValue((prev) => `${prev}${emoji}`);
      return;
    }
    const start = element.selectionStart || 0;
    const end = element.selectionEnd || start;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    setValue(next);
    setTimeout(() => {
      element.focus();
      element.selectionStart = element.selectionEnd = start + emoji.length;
    }, 0);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    try {
      await onSend(trimmed);
      setValue('');
      setShowEmojiPicker(false);
    } catch (error) {
      // handled by caller
    }
  };

  return (
    <footer className="dm-input">
      {!disabled ? (
        <form className="dm-input-form" onSubmit={handleSubmit}>
          <button
            type="button"
            className="dm-emoji-btn"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            <IoHappyOutline />
          </button>
          {showEmojiPicker && (
            <div className="dm-emoji-picker">
              <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" />
            </div>
          )}
          <textarea
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Type your message…"
            className="dm-textarea"
            rows={1}
          />
          <button type="submit" className="dm-send-btn" disabled={!value.trim()}>
            <IoSend />
          </button>
        </form>
      ) : (
        <div className="dm-offline-banner">You are offline. Reconnect to send messages.</div>
      )}
    </footer>
  );
};

export default MessageInput;
