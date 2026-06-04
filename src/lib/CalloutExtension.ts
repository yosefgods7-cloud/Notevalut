import { Blockquote } from "@tiptap/extension-blockquote";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutNodeView } from "../components/CalloutNode";

export const CalloutBlockquote = Blockquote.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
