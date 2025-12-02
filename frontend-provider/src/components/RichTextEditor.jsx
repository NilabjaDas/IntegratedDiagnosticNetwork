import React, { useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Select, Typography, Space } from "antd";
import "react-quill-new/dist/quill.snow.css";

const { Option } = Select;
const { Text } = Typography;

const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  availableVariables = [],
}) => {
  const quillRef = useRef(null);

  const handleInsertVariable = (variable) => {
    if (!variable) return;
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection(true);
    if (range) {
      quill.insertText(range.index, variable, "bold", true);
      quill.setSelection(range.index + variable.length);
    }
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ font: [] }],
      ["bold", "italic", "underline", "strike"],
      [{ align: [] }, { color: [] }, { background: [] }],
      ["blockquote"],
      [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
      ["image"],
    ],
  };

  return (
    <div
      className="rich-editor-container"
      style={{
        // Visual cue that this is an editable zone
        border: "1px dashed #d9d9d9",
        background: "rgba(255,255,255,0.8)",

        // Critical: Do NOT set height: 100%. Let it be auto.
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          background: "#f5f5f5",
          borderBottom: "1px solid #d9d9d9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          {placeholder || "Editor"}
        </Text>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Insert Variable:
          </Text>
          <Select
            size="small"
            placeholder="Select Data..."
            style={{ width: 180 }}
            onChange={handleInsertVariable}
            value={null}
            dropdownMatchSelectWidth={250}
          >
            {availableVariables.map((v, i) => (
              <Option key={i} value={v.value}>
                <span style={{ color: "#1890ff" }}>
                  {v.group ? `[${v.group}] ` : ""}
                </span>
                {v.label}
              </Option>
            ))}
          </Select>
        </Space>
      </div>

      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={onChange}
        modules={modules}
        style={{
          // Allow it to grow, but give a small click area
          minHeight: "80px",
          background: "transparent",
        }}
      />
    </div>
  );
};

export default RichTextEditor;
