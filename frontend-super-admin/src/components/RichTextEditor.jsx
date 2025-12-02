import React, { useRef } from "react";
import ReactQuill from "react-quill-new"; // CHANGED THIS
import "react-quill-new/dist/quill.snow.css"; // CHANGED THIS
import { Select, Typography, Space } from "antd";

const { Option } = Select;
const { Text } = Typography;

// Standard variables available for injection
const VARIABLES = [
  { label: "Institution Name", value: "{{institution.name}}" },
  { label: "Institution Address", value: "{{institution.address}}" },
  { label: "Patient Name", value: "{{patient.name}}" },
  { label: "Patient Age/Sex", value: "{{patient.age_sex}}" },
  { label: "Patient Mobile", value: "{{patient.mobile}}" },
  { label: "Order ID", value: "{{order.displayId}}" },
  { label: "Report Date", value: "{{date}}" },
];

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const quillRef = useRef(null);

  const handleInsertVariable = (variable) => {
    if (!variable) return;
    
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection(true);
    
    quill.insertText(range.index, variable, "bold", true);
    quill.setSelection(range.index + variable.length);
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean']
    ],
  };

  return (
    <div className="rich-editor-container">
      <div style={{ marginBottom: 8, padding: "8px 12px", background: "#fafafa", border: "1px solid #d9d9d9", borderBottom: "none", borderRadius: "4px 4px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Text strong style={{ fontSize: 12 }}>Design Area</Text>
        <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>Insert Data:</Text>
            <Select 
                size="small" 
                placeholder="Select Variable" 
                style={{ width: 160 }} 
                onChange={handleInsertVariable}
                value={null} 
                dropdownMatchSelectWidth={false}
            >
                {VARIABLES.map(v => (
                    <Option key={v.value} value={v.value}>{v.label}</Option>
                ))}
            </Select>
        </Space>
      </div>
      
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        style={{ height: 200, marginBottom: 50, background: "white" }}
      />
    </div>
  );
};

export default RichTextEditor;