import React, { useState, useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { 
  Layout, Button, Tooltip, Typography, Space, Input, 
  InputNumber, Select, ColorPicker, Radio, 
  Row, Col, Dropdown, Divider, Form
} from "antd";
import { 
  FontSizeOutlined, FileImageOutlined, 
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  DeleteOutlined, FunctionOutlined, DragOutlined
} from "@ant-design/icons";

const { Sider, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// --- EXPANDED PAPER SIZES (approx pixels at 72 DPI) ---
const PAPER_SIZES = {
  A3: { w: 842, h: 1191 },
  A4: { w: 595, h: 842 },
  A5: { w: 420, h: 595 },
  Letter: { w: 612, h: 792 },
  Legal: { w: 612, h: 1008 },
  Tabloid: { w: 792, h: 1224 },
  B4: { w: 709, h: 1001 },
  B5: { w: 499, h: 709 },
  Thermal80mm: { w: 302, h: 800 } // Fixed width, variable height
};

// Dynamic Variables available for injection
const DYNAMIC_VARS = [
  { label: "Institution Name", value: "{{institution.name}}" },
  { label: "Patient Name", value: "{{patient.firstName}} {{patient.lastName}}" },
  { label: "Patient Age/Sex", value: "{{patient.age}} / {{patient.gender}}" },
  { label: "Patient Mobile", value: "{{patient.mobile}}" },
  { label: "Order ID", value: "{{order.displayId}}" },
  { label: "Date", value: "{{formatDate order.createdAt}}" },
  { label: "Total Amount", value: "{{formatCurrency order.financials.totalAmount}}" },
];

const VisualTemplateEditor = ({ template, onChange }) => {
  const [elements, setElements] = useState(template.content?.customElements || []);
  const [selectedId, setSelectedId] = useState(null);
  const [scale, setScale] = useState(0.6); // Default zoom for better visibility
  
  const containerRef = useRef(null);
  const selectedElement = elements.find(el => el.id === selectedId);
  
  // --- FIX: DYNAMIC DIMENSION CALCULATION ---
  const baseSize = PAPER_SIZES[template.pageSize] || PAPER_SIZES.A4;
  const isLandscape = template.orientation === "landscape";
  
  // Swap width/height if landscape (unless it's thermal/square)
  const paperWidth = isLandscape ? baseSize.h : baseSize.w;
  const paperHeight = isLandscape ? baseSize.w : baseSize.h;

  // Sync internal state to parent when elements change
  useEffect(() => {
    onChange({
        ...template,
        content: {
            ...template.content,
            customElements: elements
        }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  // --- ACTIONS ---

  const addElement = (type, extra = {}) => {
    const id = `el-${Date.now()}`;
    const newEl = {
      id,
      type,
      x: 50, y: 50,
      width: type === 'IMAGE' ? 100 : 200,
      height: type === 'IMAGE' ? 100 : 30,
      content: type === 'TEXT' ? "Double click to edit" : "https://via.placeholder.com/150",
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        color: '#000000',
        textAlign: 'left',
        ...extra.style
      },
      ...extra
    };
    setElements([...elements, newEl]);
    setSelectedId(id);
  };

  const updateElement = (id, updates) => {
    setElements(els => els.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const updateStyle = (id, styleUpdates) => {
    setElements(els => els.map(el => 
      el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el
    ));
  };

  const deleteElement = (id) => {
    setElements(els => els.filter(el => el.id !== id));
    setSelectedId(null);
  };

  // --- RENDERERS ---

  return (
    <Layout style={{ height: '80vh', background: '#f5f5f5', border: '1px solid #ddd' }}>
      
      {/* LEFT TOOLBAR */}
      <Sider theme="light" width={60} style={{ borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20 }}>
         <Space direction="vertical" size="large">
            <Tooltip title="Add Text" placement="right">
                <Button shape="circle" size="large" icon={<FontSizeOutlined />} onClick={() => addElement('TEXT')} />
            </Tooltip>
            <Tooltip title="Add Variable" placement="right">
                <Dropdown 
                    menu={{
                        items: DYNAMIC_VARS.map(v => ({ 
                            key: v.value, 
                            label: v.label, 
                            onClick: () => addElement('TEXT', { content: v.value, style: { color: '#007bff' } }) 
                        }))
                    }}
                    trigger={['click']}
                >
                    <Button shape="circle" size="large" icon={<FunctionOutlined />} />
                </Dropdown>
            </Tooltip>
            <Tooltip title="Add Image" placement="right">
                <Button shape="circle" size="large" icon={<FileImageOutlined />} onClick={() => addElement('IMAGE')} />
            </Tooltip>
         </Space>
      </Sider>

      {/* CENTER CANVAS */}
      <Content style={{ display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 40, position: 'relative' }}>
        <div 
            ref={containerRef}
            style={{
                width: paperWidth,
                height: paperHeight,
                background: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                position: 'relative',
                transition: 'width 0.3s, height 0.3s' // Smooth transition for orientation change
            }}
            onClick={() => setSelectedId(null)}
        >
            {/* Margins Visualization (The Safe Zone) */}
            <div style={{
                position: 'absolute',
                top: (template.margins?.top || 10) * 3.78, 
                left: (template.margins?.left || 10) * 3.78,
                right: (template.margins?.right || 10) * 3.78,
                bottom: (template.margins?.bottom || 10) * 3.78,
                border: '1px dashed #e8e8e8',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            {/* Helper Text */}
            {elements.length === 0 && (
                <div style={{ position: 'absolute', top: '45%', width: '100%', textAlign: 'center', color: '#eee', pointerEvents: 'none' }}>
                    Drag items here
                </div>
            )}

            {/* Draggable Elements */}
            {elements.map(el => (
                <Rnd
                    key={el.id}
                    size={{ width: el.width, height: el.height }}
                    position={{ x: el.x, y: el.y }}
                    bounds="parent"
                    onDragStop={(e, d) => updateElement(el.id, { x: d.x, y: d.y })}
                    onResizeStop={(e, direction, ref, delta, position) => {
                        updateElement(el.id, { 
                            width: parseInt(ref.style.width), 
                            height: parseInt(ref.style.height),
                            ...position
                        });
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(el.id);
                    }}
                    style={{
                        border: selectedId === el.id ? '2px solid #1890ff' : '1px solid transparent',
                        ...el.style,
                        display: 'flex',
                        alignItems: el.type === 'TEXT' ? 'center' : 'flex-start',
                        justifyContent: el.style?.textAlign === 'center' ? 'center' : el.style?.textAlign === 'right' ? 'flex-end' : 'flex-start',
                    }}
                >
                    {el.type === 'TEXT' ? (
                        <span style={{ width: '100%', wordWrap: 'break-word' }}>{el.content}</span>
                    ) : (
                        <img src={el.content} alt="img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                </Rnd>
            ))}
        </div>

        {/* Zoom Controls */}
        <div style={{ position: 'fixed', bottom: 30, right: 350, background: 'white', padding: 5, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 100 }}>
            <Space>
                <Button size="small" onClick={() => setScale(s => Math.max(0.3, s - 0.1))}>-</Button>
                <span style={{ fontSize: 12, minWidth: 30, textAlign: 'center', display: 'inline-block' }}>{Math.round(scale * 100)}%</span>
                <Button size="small" onClick={() => setScale(s => Math.min(1.5, s + 0.1))}>+</Button>
            </Space>
        </div>
      </Content>

      {/* RIGHT PROPERTY PANEL */}
      <Sider theme="light" width={300} style={{ borderLeft: '1px solid #eee', padding: 15, overflowY: 'auto' }}>
        {selectedElement ? (
            <Form layout="vertical">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Title level={5} style={{ margin: 0 }}>Properties</Title>
                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => deleteElement(selectedElement.id)} />
                </div>
                
                <Divider style={{ margin: '10px 0' }} />

                <Form.Item label="Content / URL">
                    {selectedElement.type === 'TEXT' ? (
                         <TextArea 
                            rows={3} 
                            value={selectedElement.content} 
                            onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} 
                         />
                    ) : (
                         <Input 
                            placeholder="Image URL" 
                            value={selectedElement.content} 
                            onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} 
                         />
                    )}
                </Form.Item>

                <Divider style={{ margin: '10px 0' }} />
                <Row gutter={8}>
                    <Col span={12}>
                         <Form.Item label="Font Size">
                            <InputNumber 
                                value={selectedElement.style.fontSize} 
                                onChange={(v) => updateStyle(selectedElement.id, { fontSize: v })} 
                            />
                         </Form.Item>
                    </Col>
                    <Col span={12}>
                         <Form.Item label="Color">
                            <ColorPicker 
                                value={selectedElement.style.color} 
                                onChange={(c) => updateStyle(selectedElement.id, { color: c.toHexString() })} 
                            />
                         </Form.Item>
                    </Col>
                </Row>

                <Form.Item label="Alignment">
                    <Radio.Group 
                        value={selectedElement.style.textAlign || 'left'} 
                        onChange={(e) => updateStyle(selectedElement.id, { textAlign: e.target.value })}
                        buttonStyle="solid"
                        size="small"
                    >
                        <Radio.Button value="left"><AlignLeftOutlined /></Radio.Button>
                        <Radio.Button value="center"><AlignCenterOutlined /></Radio.Button>
                        <Radio.Button value="right"><AlignRightOutlined /></Radio.Button>
                    </Radio.Group>
                </Form.Item>
                
                <Form.Item label="Weight">
                    <Select 
                        value={selectedElement.style.fontWeight || 'normal'} 
                        onChange={(v) => updateStyle(selectedElement.id, { fontWeight: v })}
                    >
                        <Option value="normal">Normal</Option>
                        <Option value="bold">Bold</Option>
                        <Option value="600">Semi-Bold</Option>
                    </Select>
                </Form.Item>

                <Divider style={{ margin: '10px 0' }} />
                <div style={{ fontSize: 12, color: '#888' }}>
                    Pos: {Math.round(selectedElement.x)}, {Math.round(selectedElement.y)} <br/>
                    Size: {Math.round(selectedElement.width)} x {Math.round(selectedElement.height)}
                </div>

            </Form>
        ) : (
            <div style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>
                <DragOutlined style={{ fontSize: 24, marginBottom: 10 }} />
                <p>Select an element on the canvas to edit its properties.</p>
            </div>
        )}
      </Sider>
    </Layout>
  );
};

export default VisualTemplateEditor;