import React, { useRef, useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight"; // NEW: For Text Background
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Node, mergeAttributes, Extension } from "@tiptap/core";
import Draggable from "react-draggable";
import ReactCrop from "react-image-crop"; 
import "react-image-crop/dist/ReactCrop.css";

import { Select, Space, Button, Tooltip, Divider, ColorPicker, Upload, Dropdown, Popover, Modal } from "antd";
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined, StrikethroughOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  BlockOutlined, TableOutlined, UploadOutlined,
  InsertRowAboveOutlined, InsertRowBelowOutlined,
  InsertRowLeftOutlined, InsertRowRightOutlined, DeleteRowOutlined,
  DeleteColumnOutlined, BorderOuterOutlined, GatewayOutlined, PictureOutlined,
  ScissorOutlined, BgColorsOutlined, CompressOutlined, UngroupOutlined,
  FontSizeOutlined, HighlightOutlined
} from "@ant-design/icons";

const { Option } = Select;

// =========================================================
// UTILITY: Canvas Crop Helper
// =========================================================
const getCroppedImg = (image, crop) => {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result);
      };
    }, "image/png");
  });
};

// =========================================================
// 1. CUSTOM EXTENSION: Text Shadow (New)
// =========================================================
const TextShadow = Extension.create({
  name: 'textShadow',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        textShadow: {
          default: null,
          parseHTML: element => element.style.textShadow || null,
          renderHTML: attributes => {
            if (!attributes.textShadow) return {};
            return { style: `text-shadow: ${attributes.textShadow}` };
          }
        }
      }
    }]
  },
  addCommands() {
    return {
      setTextShadow: (value) => ({ chain }) => chain().setMark('textStyle', { textShadow: value }).run(),
      unsetTextShadow: () => ({ chain }) => chain().setMark('textStyle', { textShadow: null }).run()
    }
  }
});

// =========================================================
// 2. CUSTOM EXTENSION: Font Size
// =========================================================
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark("textStyle", { fontSize: null }).run(),
    };
  },
});

// =========================================================
// 3. CUSTOM NODE: Resizable Image
// =========================================================
const ResizableImage = ImageExtension.extend({
  name: 'resizableImage',
  group: 'inline',
  inline: true,
  
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { 
        default: "200px",
        parseHTML: (element) => element.style.width || element.getAttribute('width'),
      },
      align: { 
        default: "center",
        parseHTML: (element) => element.getAttribute('data-align') || (element.style.float === 'left' ? 'left' : element.style.float === 'right' ? 'right' : 'center'),
      },
    };
  },
  
  parseHTML() { return [{ tag: 'img[data-type="resizable-image"]' }]; },

  renderHTML({ HTMLAttributes }) {
    const { align } = HTMLAttributes;
    let style = `width: ${HTMLAttributes.width};`;
    if (align === 'left') style += ' float: left; margin-right: 15px; margin-bottom: 10px; display: block;';
    else if (align === 'right') style += ' float: right; margin-left: 15px; margin-bottom: 10px; display: block;';
    else style += ' display: block; margin-left: auto; margin-right: auto;';

    return [
      "img", 
      mergeAttributes(this.options.HTMLAttributes, { 
        "data-type": "resizable-image",
        "data-align": align,
        src: HTMLAttributes.src,
        style
      })
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node, updateAttributes, selected }) => {
      const handleResize = (e) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX;
        const startWidth = parseInt(node.attrs.width || "200", 10);
        const onMouseMove = (moveEvent) => {
          const diff = moveEvent.clientX - startX;
          updateAttributes({ width: `${Math.max(50, startWidth + diff)}px` });
        };
        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };

      const { align } = node.attrs;
      const wrapperStyle = {
          position: 'relative',
          lineHeight: 0,
          display: align === 'center' ? 'block' : 'inline-block',
          float: align === 'center' ? 'none' : align,
          marginRight: align === 'left' ? '15px' : '0',
          marginLeft: align === 'right' ? '15px' : '0',
          marginBottom: '10px',
          textAlign: align === 'center' ? 'center' : undefined,
          clear: align === 'center' ? 'both' : 'none',
          verticalAlign: 'top'
      };

      return (
        <NodeViewWrapper as="span" style={wrapperStyle}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={node.attrs.src}
                  alt=""
                  style={{ width: node.attrs.width, display: "block", boxShadow: selected ? "0 0 0 3px #1890ff" : "none" }}
                />
                {selected && (
                  <span
                    onMouseDown={handleResize}
                    style={{
                      width: "12px", height: "12px", backgroundColor: "#1890ff",
                      border: "1px solid white", position: "absolute", bottom: "5px", right: "5px",
                      cursor: "nwse-resize", borderRadius: "50%", zIndex: 10, display: "block"
                    }}
                  />
                )}
            </span>
        </NodeViewWrapper>
      );
    });
  },
});

// =========================================================
// 4. TABLE EXTENSIONS
// =========================================================
const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'border-collapse: collapse; width: 100%;',
        renderHTML: () => ({ style: 'border-collapse: collapse; width: 100%;' }),
      }
    };
  },
}).configure({ resizable: true });

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor,
        renderHTML: (attributes) => ({ style: attributes.backgroundColor ? `background-color: ${attributes.backgroundColor}` : null }),
      },
      borderColor: {
        default: '#ced4da',
        parseHTML: (element) => element.style.borderColor,
      },
      borderWidth: {
        default: '1px',
        parseHTML: (element) => element.style.borderWidth,
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { backgroundColor, borderColor, borderWidth, style, ...rest } = HTMLAttributes;
    const borderStyle = `border: ${borderWidth || '1px'} solid ${borderColor || '#ced4da'}`;
    const bgStyle = backgroundColor ? `background-color: ${backgroundColor}` : '';
    const combinedStyle = `${borderStyle}; ${bgStyle}; padding: 5px; ${style || ''}`;
    return ['td', { style: combinedStyle, ...rest }, 0];
  }
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: '#f1f3f5',
        parseHTML: (element) => element.style.backgroundColor,
        renderHTML: (attributes) => ({ style: attributes.backgroundColor ? `background-color: ${attributes.backgroundColor}` : null }),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { backgroundColor, style, ...rest } = HTMLAttributes;
    const borderStyle = `border: 1px solid #ced4da`;
    const bgStyle = backgroundColor ? `background-color: ${backgroundColor}` : 'background-color: #f1f3f5';
    const combinedStyle = `${borderStyle}; ${bgStyle}; padding: 5px; font-weight: bold; ${style || ''}`;
    return ['th', { style: combinedStyle, ...rest }, 0];
  }
});

// =========================================================
// 5. CUSTOM NODE: Shapes
// =========================================================
const ShapeNode = Node.create({
  name: "shape",
  group: "block",
  atom: true,
  draggable: true, 
  addAttributes() {
    return {
      type: { default: "box" },
      width: { default: "100px" },
      height: { default: "100px" },
      color: { default: "#cccccc" },
      align: { default: "center" }
    };
  },
  parseHTML() { return [{ tag: 'div[data-type="shape"]' }]; },
  renderHTML({ HTMLAttributes }) {
    const isCircle = HTMLAttributes.type === 'circle';
    const alignStyles = { 'left': 'margin-right: auto;', 'center': 'margin-left: auto; margin-right: auto;', 'right': 'margin-left: auto;' };
    const style = `width: ${HTMLAttributes.width}; height: ${HTMLAttributes.height}; background-color: ${HTMLAttributes.color}; border-radius: ${isCircle ? '50%' : '0'}; display: block; ${alignStyles[HTMLAttributes.align] || ''}`;
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "shape", style }), ""];
  },
  addNodeView() {
    return ReactNodeViewRenderer(({ node, updateAttributes, selected }) => {
      const handleResize = (e) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX;
        const startWidth = parseInt(node.attrs.width, 10);
        const startHeight = parseInt(node.attrs.height, 10);
        const onMouseMove = (moveEvent) => {
          const diff = moveEvent.clientX - startX;
          updateAttributes({ width: `${Math.max(20, startWidth + diff)}px`, height: `${Math.max(20, startHeight + diff)}px` });
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };
      const justifyContent = node.attrs.align === 'left' ? 'flex-start' : node.attrs.align === 'right' ? 'flex-end' : 'center';
      return (
        <NodeViewWrapper style={{ display: 'flex', justifyContent, margin: '10px 0' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: node.attrs.width, height: node.attrs.height, background: node.attrs.color, borderRadius: node.attrs.type === 'circle' ? "50%" : "0", border: selected ? "2px solid #1890ff" : "1px solid #999" }} />
             {selected && <div onMouseDown={handleResize} style={{ width: "10px", height: "10px", background: "#1890ff", position: "absolute", bottom: 0, right: 0, cursor: "se-resize", zIndex: 10 }} />}
          </div>
        </NodeViewWrapper>
      );
    });
  }
});

// =========================================================
// 6. BANNER COMPONENT
// =========================================================
const BannerNodeView = (props) => {
  const { node, updateAttributes, selected, editor, getPos } = props;
  const containerRef = useRef(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  const handleWrapperClick = () => {
    if (typeof getPos === 'function') {
      editor.commands.setNodeSelection(getPos());
    }
  };

  const handleBannerResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startWidth = containerRef.current.offsetWidth;
    const startHeight = containerRef.current.offsetHeight;
    const onMouseMove = (moveEvent) => {
      const diffX = moveEvent.clientX - startX;
      updateAttributes({ width: `${Math.max(100, startWidth + diffX)}px`, height: `${Math.max(50, startHeight + (moveEvent.clientY - e.clientY))}px` });
    };
    const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onLoad = useCallback((img) => { imgRef.current = img; }, []);
  const handleCropSave = async () => {
    if (completedCrop && imgRef.current) {
        const croppedBase64 = await getCroppedImg(imgRef.current, completedCrop);
        updateAttributes({ src: croppedBase64 });
        setIsModalOpen(false);
        setCrop(undefined); 
    }
  };

  return (
    <NodeViewWrapper 
        ref={containerRef}
        onClick={handleWrapperClick}
        style={{ 
            position: "relative", marginBottom: "1rem", 
            width: node.attrs.width, height: node.attrs.height,
            backgroundImage: `url(${node.attrs.src})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
            border: selected ? "2px solid #1890ff" : "1px dashed #d9d9d9",
            boxSizing: 'border-box'
        }}
    >
      <div style={{ height: '100%', width: '100%', padding: '10px', overflow: 'hidden' }}>
         <NodeViewContent />
      </div>
      {selected && (
        <div onMouseDown={handleBannerResize} style={{
            width: "15px", height: "15px", background: "#1890ff", position: "absolute",
            bottom: 0, right: 0, cursor: "nwse-resize", zIndex: 20, borderRadius: "4px 0 0 0"
        }} />
      )}
      {selected && (
          <Tooltip title="Crop Background">
            <Button type="primary" shape="circle" icon={<ScissorOutlined />} size="small"
                style={{ position: 'absolute', top: -15, right: -15, zIndex: 100 }}
                onMouseDown={(e) => { e.stopPropagation(); setIsModalOpen(true); }} 
            />
          </Tooltip>
      )}
      <Modal title="Crop Background" open={isModalOpen} onOk={handleCropSave} onCancel={() => setIsModalOpen(false)} width={800} destroyOnClose zIndex={10000}>
        <div style={{ display: 'flex', justifyContent: 'center', background: '#f0f0f0', padding: 20 }}>
            {node.attrs.src && (
                <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)} aspect={undefined}>
                    <img src={node.attrs.src} onLoad={(e) => onLoad(e.currentTarget)} alt="Crop me" style={{ maxWidth: '100%', maxHeight: '60vh' }} />
                </ReactCrop>
            )}
        </div>
      </Modal>
    </NodeViewWrapper>
  );
};

const BannerNode = Node.create({
  name: "banner",
  group: "block",
  content: "block+", 
  atom: false,
  addAttributes() {
    return {
      src: { default: null, parseHTML: (el) => el.style.backgroundImage?.slice(4, -1).replace(/"/g, "") },
      width: { default: "100%", parseHTML: (el) => el.style.width },
      height: { default: "250px", parseHTML: (el) => el.style.height },
    };
  },
  parseHTML() { return [{ tag: 'div[data-type="banner"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { 
          "data-type": "banner", 
          style: `background-image: url('${HTMLAttributes.src}'); background-size: 100% 100%; background-repeat: no-repeat; width: ${HTMLAttributes.width}; height: ${HTMLAttributes.height}; margin-bottom: 10px; padding: 10px; overflow: hidden;` 
      }),
      0
    ];
  },
  addNodeView() { return ReactNodeViewRenderer(BannerNodeView); },
});

// =========================================================
// 7. TOOLBAR COMPONENT
// =========================================================
const MenuBar = ({ editor }) => {
  if (!editor) return null;

  // READ CURRENT VALUES FOR SYNC
  const currentFontSize = editor.getAttributes('textStyle').fontSize?.replace('px', '') || '';
  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || 'Inter';
  const currentColor = editor.getAttributes('textStyle').color || '#000000';
  const currentBgColor = editor.getAttributes('highlight').color; // Highlight color
  
  // Alignment Logic (Image vs Text)
  const isImageActive = editor.isActive('resizableImage');
  const isShapeActive = editor.isActive('shape');
  
  let currentAlign = 'left';
  if (isImageActive) currentAlign = editor.getAttributes('resizableImage').align;
  else if (isShapeActive) currentAlign = editor.getAttributes('shape').align;
  else {
      if (editor.isActive({ textAlign: 'center' })) currentAlign = 'center';
      else if (editor.isActive({ textAlign: 'right' })) currentAlign = 'right';
  }

  const setAlignment = (align) => {
    if (isImageActive) editor.chain().focus().updateAttributes('resizableImage', { align }).run();
    else if (isShapeActive) editor.chain().focus().updateAttributes('shape', { align }).run();
    else editor.chain().focus().setTextAlign(align).run();
  };

  const readFile = (file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
  });

  const handleImageUpload = async (file) => {
    const src = await readFile(file);
    editor.chain().focus().insertContent({ type: "resizableImage", attrs: { src } }).run();
    return false; 
  };

  const handleBannerUpload = async (file) => {
    const src = await readFile(file);
    editor.chain().focus().insertContent({ 
        type: "banner", 
        attrs: { src }, 
        content: [{ type: "paragraph", content: [{ type: "text", text: "Type here..." }] }] 
    }).run();
    return false;
  };

  const isTableActive = editor.isActive("table");
  const updateTableBorder = (color) => {
      editor.chain().focus().updateAttributes('tableCell', { borderColor: color.toHexString() }).run();
      editor.chain().focus().updateAttributes('tableHeader', { borderColor: color.toHexString() }).run();
  };
  const updateTableBorderWidth = (width) => {
      editor.chain().focus().updateAttributes('tableCell', { borderWidth: `${width}px` }).run();
      editor.chain().focus().updateAttributes('tableHeader', { borderWidth: `${width}px` }).run();
  };
  const updateCellBackground = (color) => {
      editor.chain().focus().setCellAttribute('backgroundColor', color.toHexString()).run();
  };

  return (
    <div style={{ padding: "8px", borderBottom: "1px solid #d9d9d9", background: "#fafafa", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
      
      {/* Font & Size */}
      <Space size={4}>
        <Select size="small" placeholder="Font" style={{ width: 140 }} value={currentFontFamily} onChange={(val) => editor.chain().focus().setFontFamily(val).run()} dropdownMatchSelectWidth={false}>
          <Option value="Inter">Inter</Option>
          <Option value="Roboto">Roboto</Option>
          <Option value="Arial">Arial</Option>
          <Option value="Georgia">Georgia</Option>
          <Option value="Courier New">Courier</Option>
        </Select>
        <Select size="small" placeholder="Size" style={{ width: 80 }} value={currentFontSize ? parseInt(currentFontSize) : undefined} onChange={(val) => editor.chain().focus().setFontSize(`${val}px`).run()} dropdownMatchSelectWidth={false}>
          {[10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 64, 72].map(s => <Option key={s} value={s}>{s}px</Option>)}
        </Select>
      </Space>

      <Divider type="vertical" />

      {/* Formatting */}
      <Button.Group>
        <Button size="small" icon={<BoldOutlined />} onClick={() => editor.chain().focus().toggleBold().run()} type={editor.isActive("bold") ? "primary" : "default"} />
        <Button size="small" icon={<ItalicOutlined />} onClick={() => editor.chain().focus().toggleItalic().run()} type={editor.isActive("italic") ? "primary" : "default"} />
        <Button size="small" icon={<UnderlineOutlined />} onClick={() => editor.chain().focus().toggleUnderline().run()} type={editor.isActive("underline") ? "primary" : "default"} />
        <Button size="small" icon={<StrikethroughOutlined />} onClick={() => editor.chain().focus().toggleStrike().run()} type={editor.isActive("strike") ? "primary" : "default"} />
      </Button.Group>

      {/* Colors & Highlight */}
      <Tooltip title="Text Color">
        <ColorPicker size="small" value={currentColor} onChange={(c) => editor.chain().focus().setColor(c.toHexString()).run()} />
      </Tooltip>
      <Tooltip title="Text Background">
        <ColorPicker size="small" value={currentBgColor} onChange={(c) => editor.chain().focus().toggleHighlight({ color: c.toHexString() }).run()}>
           <Button size="small" icon={<HighlightOutlined />} type={editor.isActive('highlight') ? 'primary' : 'default'} />
        </ColorPicker>
      </Tooltip>
      
      {/* Shadow Dropdown */}
      <Dropdown menu={{
          items: [
              { key: 'none', label: 'None', onClick: () => editor.chain().focus().unsetTextShadow().run() },
              { key: 'light', label: 'Light', onClick: () => editor.chain().focus().setTextShadow('1px 1px 2px rgba(0,0,0,0.3)').run() },
              { key: 'hard', label: 'Hard', onClick: () => editor.chain().focus().setTextShadow('2px 2px 0px rgba(0,0,0,0.5)').run() },
              { key: 'glow', label: 'Glow', onClick: () => editor.chain().focus().setTextShadow('0px 0px 5px rgba(255,200,0,0.8)').run() },
          ]
      }}>
         <Button size="small" icon={<FontSizeOutlined />}>Shadow</Button>
      </Dropdown>

      {/* Alignment */}
      <Button.Group>
        <Button size="small" icon={<AlignLeftOutlined />} onClick={() => setAlignment("left")} type={currentAlign === 'left' ? "primary" : "default"} />
        <Button size="small" icon={<AlignCenterOutlined />} onClick={() => setAlignment("center")} type={currentAlign === 'center' ? "primary" : "default"} />
        <Button size="small" icon={<AlignRightOutlined />} onClick={() => setAlignment("right")} type={currentAlign === 'right' ? "primary" : "default"} />
      </Button.Group>

      <Divider type="vertical" />

      {/* Table */}
      <Popover 
        content={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Space>
               <Button size="small" icon={<TableOutlined />} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>3x3</Button>
               <Button size="small" danger icon={<BorderOuterOutlined />} onClick={() => editor.chain().focus().deleteTable().run()} disabled={!isTableActive} />
            </Space>
            {isTableActive && (
              <>
                <Divider style={{ margin: "5px 0" }} />
                <Space size={2}>
                  <Button size="small" icon={<InsertRowLeftOutlined rotate={90} />} onClick={() => editor.chain().focus().addColumnBefore().run()} />
                  <Button size="small" icon={<InsertRowRightOutlined rotate={90} />} onClick={() => editor.chain().focus().addColumnAfter().run()} />
                  <Button size="small" danger icon={<DeleteColumnOutlined />} onClick={() => editor.chain().focus().deleteColumn().run()} />
                </Space>
                <Space size={2}>
                  <Button size="small" icon={<InsertRowAboveOutlined />} onClick={() => editor.chain().focus().addRowBefore().run()} />
                  <Button size="small" icon={<InsertRowBelowOutlined />} onClick={() => editor.chain().focus().addRowAfter().run()} />
                  <Button size="small" danger icon={<DeleteRowOutlined />} onClick={() => editor.chain().focus().deleteRow().run()} />
                </Space>
                <Space size={2} style={{ marginTop: 5 }}>
                   <Tooltip title="Merge Cells"><Button size="small" icon={<CompressOutlined />} onClick={() => editor.chain().focus().mergeCells().run()} /></Tooltip>
                   <Tooltip title="Split Cell"><Button size="small" icon={<UngroupOutlined />} onClick={() => editor.chain().focus().splitCell().run()} /></Tooltip>
                </Space>
                <Divider style={{ margin: "5px 0" }} />
                <Space>
                    <Tooltip title="Cell BG"><ColorPicker size="small" onChange={updateCellBackground} icon={<BgColorsOutlined />} /></Tooltip>
                    <Tooltip title="Border Color"><ColorPicker size="small" onChange={updateTableBorder} /></Tooltip>
                    <Select size="small" defaultValue={1} onChange={updateTableBorderWidth} style={{ width: 60 }}>
                        <Option value={0}>0px</Option>
                        <Option value={1}>1px</Option>
                        <Option value={2}>2px</Option>
                    </Select>
                </Space>
              </>
            )}
          </div>
        } 
        title="Table Controls" 
        trigger="click"
      >
         <Button size="small" icon={<TableOutlined />} type={isTableActive ? "primary" : "default"}>Table</Button>
      </Popover>

      <Divider type="vertical" />

      {/* Images & Banner */}
      <Upload beforeUpload={handleImageUpload} showUploadList={false}>
         <Tooltip title="Insert Image"><Button size="small" icon={<UploadOutlined />} /></Tooltip>
      </Upload>
      <Upload beforeUpload={handleBannerUpload} showUploadList={false}>
         <Tooltip title="Insert Banner Background"><Button size="small" icon={<PictureOutlined />} /></Tooltip>
      </Upload>

      <Divider type="vertical" />

      {/* Shapes */}
      <Dropdown 
        menu={{
            items: [
                { key: '1', label: 'Box', icon: <BlockOutlined />, onClick: () => editor.chain().focus().insertContent({ type: 'shape', attrs: { type: 'box' } }).run() },
                { key: '2', label: 'Circle', icon: <GatewayOutlined />, onClick: () => editor.chain().focus().insertContent({ type: 'shape', attrs: { type: 'circle' } }).run() },
            ]
        }} 
        placement="bottomRight"
      >
         <Button size="small" icon={<BlockOutlined />}>Shapes</Button>
      </Dropdown>

    </div>
  );
};

// =========================================================
// 8. MAIN EXPORT
// =========================================================
const RichTextEditor = ({ value, onChange, placeholder, availableVariables = [] }) => {
  // State to force re-render of toolbar
  const [, forceUpdate] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, Color, FontFamily, FontSize, Highlight.configure({ multicolor: true }), TextShadow,
      ResizableImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CustomTable, TableRow, CustomTableHeader, CustomTableCell,
      BannerNode, ShapeNode
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onTransaction: () => {
        // CRITICAL: Forces React to re-render MenuBar when selection/attributes change
        forceUpdate((n) => n + 1);
    },
  });

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
        if (Math.abs(editor.getHTML().length - value.length) > 10) { 
             editor.commands.setContent(value);
        }
    }
  }, [value, editor]);

  const handleInsertVariable = (variable) => {
    if (editor) editor.chain().focus().insertContent(variable).run();
  };

  return (
    <div style={{ border: "1px solid #d9d9d9", borderRadius: "4px", background: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", background: "#f5f5f5", borderBottom: "1px solid #d9d9d9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 12 }}>{placeholder || "Document Editor"}</span>
        <Space>
           <span style={{ fontSize: 12, color: '#666' }}>Insert Data:</span>
           <Select size="small" placeholder="Select..." style={{ width: 160 }} onChange={handleInsertVariable}>
             {availableVariables.map((v, i) => <Option key={i} value={v.value}>{v.label}</Option>)}
           </Select>
        </Space>
      </div>

      <MenuBar editor={editor} />

      <div style={{ padding: "12px", minHeight: "200px", maxHeight: "500px", overflowY: "auto" }}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror { outline: none; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #ccc; float: left; height: 0; pointer-events: none; }
        /* Table Styles */
        .ProseMirror table { border-collapse: collapse; margin: 0; overflow: hidden; table-layout: fixed; width: 100%; }
        .ProseMirror td, .ProseMirror th { padding: 5px; position: relative; vertical-align: top; border: 1px solid #ced4da; }
        /* Crop Modal Image */
        .ReactCrop__image { max-width: 100%; max-height: 60vh; }
      `}</style>
    </div>
  );
};

export default RichTextEditor;