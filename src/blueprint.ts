/*!
# xin-codemirror

Information about the `<xin-codemirror>` component blueprint.
*/

import { XinBlueprint, XinFactory } from 'xinjs'

// --- Static Imports (Bundled) ---
// These will be compiled directly into the blueprint file.
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from '@codemirror/language'
import {
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
  completionKeymap,
} from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'

// --- Languages (Statically Bundled) ---
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'

// --- Standard Setup ---
// Recreating 'basicSetup' manually allows for tree-shaking and finer control
const basicSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
  ]),
]

// Map modes to extensions
const languageExtensions: Record<string, any> = {
  javascript: () => javascript(),
  js: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  ts: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  html: () => html(),
  css: () => css(),
  json: () => json(),
}

// --- The Blueprint ---
export const codeMirrorBlueprint: XinBlueprint = (
  tag: string,
  factory: XinFactory
) => {
  const { Component } = factory

  class XinCodeMirror extends Component {
    private _view: EditorView | undefined
    private _value = ''

    // Compartments allow dynamic reconfiguration without destroying state
    private compartments = {
      language: new Compartment(),
      readOnly: new Compartment(),
      theme: new Compartment(),
    }

    mode = 'javascript'
    disabled = false
    role = 'code editor'

    static styleSpec = {
      ':host': {
        display: 'block',
        width: '100%',
        height: '100%',
        position: 'relative',
        textAlign: 'left',
        fontSize: '14px',
        overflow: 'hidden',
        backgroundColor: '#fff',
      },
      '.cm-editor': {
        height: '100%',
      },
      '.cm-scroller': {
        outline: 'none',
        fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      },
    }

    get value(): string {
      return this._view ? this._view.state.doc.toString() : this._value
    }

    set value(text: string) {
      if (this._view) {
        const current = this._view.state.doc.toString()
        if (text !== current) {
          this._view.dispatch({
            changes: { from: 0, to: current.length, insert: text },
          })
        }
      } else {
        this._value = text
      }
    }

    // Convenience getter for the raw EditorView instance
    get editorView() {
      return this._view
    }

    constructor() {
      super()
      this.initAttributes('mode', 'disabled')
    }

    onResize() {
      if (this._view) this._view.requestMeasure()
    }

    connectedCallback() {
      super.connectedCallback()

      if (
        this._value === '' &&
        this.textContent &&
        this.textContent.trim().length > 0
      ) {
        this._value = this.textContent.trim()
        this.textContent = ''
      }

      if (!this._view) {
        this.createEditor()
      }
    }

    private createEditor() {
      const startState = EditorState.create({
        doc: this._value,
        extensions: [
          basicSetup,
          this.compartments.language.of(this.getLanguageExtension(this.mode)),
          this.compartments.readOnly.of(EditorState.readOnly.of(this.disabled)),

          // Sync changes back to the component
          EditorView.updateListener.of((v) => {
            if (v.docChanged) {
              this.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }),
        ],
      })

      this._view = new EditorView({
        state: startState,
        parent: this,
      })
    }

    private getLanguageExtension(mode: string) {
      const factory = languageExtensions[mode.toLowerCase()]
      return factory ? factory() : []
    }

    render() {
      super.render()
      if (this._view) {
        this._view.dispatch({
          effects: [
            this.compartments.language.reconfigure(
              this.getLanguageExtension(this.mode)
            ),
            this.compartments.readOnly.reconfigure(
              EditorState.readOnly.of(this.disabled)
            ),
          ],
        })
      }
    }
  }

  return {
    type: XinCodeMirror,
    creator: XinCodeMirror.elementCreator({ tag }),
  }
}

export default codeMirrorBlueprint
