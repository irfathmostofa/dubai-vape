import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface TiptapProductEditorProps {
  value: string;
  onChange: (html: string) => void;
  productTitle?: string;
  categoryName?: string;
}

export function TiptapProductEditor({
  value,
  onChange,
  productTitle,
  categoryName,
}: TiptapProductEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder:
          'Write rich product description, flavour notes, and bulleted hardware highlights...',
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        'data-testid': 'tiptap-rich-text-content',
        class:
          'min-h-[150px] max-h-[260px] overflow-y-auto px-3.5 py-2.5 text-xs leading-relaxed text-zinc-900 focus:outline-none prose prose-xs max-w-none [&_h2]:font-display [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-zinc-950 [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:font-display [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-zinc-900 [&_h3]:mt-1.5 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1.5 [&_li]:my-0.5',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  // Sync external resets or edits when value changes from outside
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (value !== currentHtml) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-500">
        Loading TipTap Rich Text Editor...
      </div>
    );
  }

  const handleInsertSpecTemplate = () => {
    const titleLabel = productTitle?.trim() || 'Premium UAE Vape Edition';
    const catLabel = categoryName || 'Disposable Vape';
    const templateHtml = `<h2>${titleLabel} — ${catLabel}</h2><p>Engineered for UAE adult vapers with <strong>100% ESMA MoIAT authenticity verification</strong> and climate-controlled storage in our Al Quoz Dubai fulfillment hub.</p><ul><li>Dual-mesh heating architecture for consistent vapour &amp; flavour fidelity</li><li>USB-C rapid recharge with smart OLED battery &amp; e-liquid telemetry</li><li>Same-day 2-hour Cash on Delivery across Dubai, Abu Dhabi &amp; Sharjah</li></ul>`;
    editor.commands.setContent(templateHtml, { emitUpdate: true });
    onChange(templateHtml);
  };

  const handleClearEditor = () => {
    editor.commands.clearContent(true);
    onChange('');
  };

  return (
    <div
      data-testid="tiptap-editor-container"
      className="border border-zinc-300 bg-white focus-within:border-zinc-950"
    >
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            data-testid="tiptap-btn-bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
            className={`inline-flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
              editor.isActive('bold')
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
            }`}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="tiptap-btn-italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
            className={`inline-flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
              editor.isActive('italic')
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
            }`}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="tiptap-btn-underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
            className={`inline-flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
              editor.isActive('underline')
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
            }`}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>

          <span className="mx-0.5 h-4 w-px bg-zinc-300" />

          <button
            type="button"
            data-testid="tiptap-btn-h2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
            className={`inline-flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
            }`}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="tiptap-btn-h3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
            className={`inline-flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
              editor.isActive('heading', { level: 3 })
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
            }`}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </button>

          <span className="mx-0.5 h-4 w-px bg-zinc-300" />

          <button
            type="button"
            data-testid="tiptap-btn-bullet-list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List (Highlights)"
            className={`inline-flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
              editor.isActive('bulletList')
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
            }`}
          >
            <List className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="tiptap-btn-ordered-list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
            className={`inline-flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
              editor.isActive('orderedList')
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
            }`}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="tiptap-btn-insert-template"
            onClick={handleInsertSpecTemplate}
            className="inline-flex items-center gap-1 border border-emerald-600/40 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900 transition-colors hover:bg-emerald-100"
          >
            <Sparkles className="h-3 w-3 text-emerald-700" />
            <span>UAE Spec Template</span>
          </button>

          <button
            type="button"
            data-testid="tiptap-btn-clear"
            onClick={handleClearEditor}
            title="Clear Editor"
            className="inline-flex h-7 w-7 items-center justify-center border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-zinc-950 hover:text-zinc-950"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Rich Text Content Surface */}
      <EditorContent editor={editor} />

      {/* Footer status bar */}
      <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-3 py-1 text-[10px] text-zinc-500">
        <span>TipTap Rich Text Editor · Supports H2/H3, Bold, Underline &amp; Bullet Highlights</span>
        <span className="font-mono-num">HTML Sync Active</span>
      </div>
    </div>
  );
}
