/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

((global) => {
  const bottomThreshold = 48;

  function shouldStartNewSegment(hasActiveSegment, activeMessageId, incomingMessageId, activeSegmentIsTail) {
    return !hasActiveSegment
      || !activeSegmentIsTail
      || Boolean(incomingMessageId && activeMessageId !== incomingMessageId);
  }

  function shouldStickToBottom(scrollHeight, scrollTop, clientHeight) {
    return scrollHeight - scrollTop - clientHeight <= bottomThreshold;
  }

  global.GrokConversationTimeline = Object.freeze({
    shouldStartNewSegment,
    shouldStickToBottom,
  });
})(globalThis);
