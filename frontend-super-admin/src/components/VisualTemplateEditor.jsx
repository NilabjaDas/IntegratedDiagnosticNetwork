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

const PAPER_SIZES = {
  A3: { w: 842, h: 1191 },
  A4: { w: 595, h: 842 },
  A5: { w: 420, h: 595 },
  Letter: { w: 612, h: 792 },
  Legal: { w: 612, h: 1008 },
  Tabloid: { w: 792, h: 1224 },
  B4: { w: 709, h: 1001 },
  B5: { w: 499, h: 709 },
  Thermal80mm: { w: 302, h: 800 } 
};

const VisualTemplateEditor = ({ template, onChange }) => {
  // Initialize state from props
  const [elements, setElements] = useState(template.content?.customElements || []);
  const [selectedId, setSelectedId] = useState(null);
  const [scale, setScale] = useState(0.6); 
  
  const containerRef = useRef(null);
  const selectedElement = elements.find(el => el.id === selectedId);
  
  // Dimensions
  const baseSize = PAPER_SIZES[template.pageSize] || PAPER_SIZES.A4;
  const isLandscape = template.orientation === "landscape";
  const paperWidth = isLandscape ? baseSize.h : baseSize.w;
  const paperHeight = isLandscape ? baseSize.w : baseSize.h;

  // --- CRITICAL FIX: Propagate Changes Upwards ---
  // Whenever 'elements' state changes, we notify the parent (BillingTemplateEditor)
  useEffect(() => {
    onChange({
        customElements: elements
    });
    // eslint-disable-next-line
  }, [elements]);

  // --- Actions ---
  const addElement = (type) => {
    const id = `el-${Date.now()}`;
    const newEl = {
      id,
      type,
      x: 50, y: 50,
      width: type === 'IMAGE' ? 100 : 200,
      height: type === 'IMAGE' ? 100 : 40,
      content: type === 'TEXT' ? "Text Block" : "https://via.placeholder.com/150",
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        color: '#000000',
        textAlign: 'left'
      }
    };
    setElements(prev => [...prev, newEl]);
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

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      {/* Left Toolbar */}
      <Sider theme="light" width={50} style={{ borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
         <Space direction="vertical">
            <Tooltip title="Add Text" placement="right">
                <Button shape="circle" icon={<FontSizeOutlined />} onClick={() => addElement('TEXT')} />
            </Tooltip>
            <Tooltip title="Add Image" placement="right">
                <Button shape="circle" icon={<FileImageOutlined />} onClick={() => addElement('IMAGE')} />
            </Tooltip>
         </Space>
      </Sider>

      {/* Canvas */}
      <Content style={{ display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 40, position: 'relative' }} onClick={() => setSelectedId(null)}>
        <div 
            style={{
                width: paperWidth,
                height: paperHeight,
                background: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                position: 'relative',
                transition: 'width 0.3s, height 0.3s'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Margins Indicator */}
            <div style={{
                position: 'absolute',
                top: (template.margins?.top || 10) * 3.78, 
                left: (template.margins?.left || 10) * 3.78,
                right: (template.margins?.right || 10) * 3.78,
                bottom: (template.margins?.bottom || 10) * 3.78,
                border: '1px dashed #ddd',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            {/* Elements */}
            {elements.map(el => (
                <Rnd
                    key={el.id}
                    size={{ width: el.width, height: el.height }}
                    position={{ x: el.x, y: el.y }}
                    bounds="parent"
                    onDragStop={(e, d) => updateElement(el.id, { x: d.x, y: d.y })}
                    onResizeStop={(e, direction, ref, delta, position) => {
                        updateElement(el.id, { width: parseInt(ref.style.width), height: parseInt(ref.style.height), ...position });
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                    style={{
                        border: selectedId === el.id ? '2px solid #1890ff' : '1px dashed transparent',
                        cursor: 'move'
                    }}
                >
                    <div style={{ 
                        width: '100%', height: '100%', 
                        display: 'flex', 
                        alignItems: 'center',
                        ...el.style,
                        justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start'
                    }}>
                        {el.type === 'TEXT' ? el.content : <img src={el.content} alt="" style={{width:'100%', height:'100%', objectFit:'contain'}} />}
                    </div>
                </Rnd>
            ))}
        </div>
        
        {/* Zoom */}
        <div style={{ position: 'fixed', bottom: 30, right: 350, background: 'white', padding: 5, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 100 }}>
            <Space>
                <Button size="small" onClick={() => setScale(s => Math.max(0.3, s - 0.1))}>-</Button>
                <span style={{ fontSize: 12 }}>{Math.round(scale * 100)}%</span>
                <Button size="small" onClick={() => setScale(s => Math.min(1.5, s + 0.1))}>+</Button>
            </Space>
        </div>
      </Content>

      {/* Right Properties */}
      <Sider theme="light" width={280} style={{ borderLeft: '1px solid #eee', padding: 15, overflowY: 'auto' }}>
        {selectedElement ? (
            <Form layout="vertical">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Title level={5} style={{ margin: 0 }}>Properties</Title>
                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => deleteElement(selectedElement.id)} />
                </div>
                <Divider style={{ margin: '10px 0' }} />

                <Form.Item label="Content">
                    {selectedElement.type === 'TEXT' ? (
                         <TextArea rows={3} value={selectedElement.content} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} />
                    ) : (
                         <Input placeholder="Image URL" value={selectedElement.content} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} />
                    )}
                </Form.Item>
                
                <Row gutter={8}>
                    <Col span={12}><Form.Item label="Size"><InputNumber value={selectedElement.style.fontSize} onChange={(v) => updateStyle(selectedElement.id, { fontSize: v })} /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Color"><ColorPicker value={selectedElement.style.color} onChange={(c) => updateStyle(selectedElement.id, { color: c.toHexString() })} /></Form.Item></Col>
                </Row>
                
                <Form.Item label="Align">
                    <Radio.Group value={selectedElement.style.textAlign || 'left'} onChange={(e) => updateStyle(selectedElement.id, { textAlign: e.target.value })} size="small" buttonStyle="solid">
                        <Radio.Button value="left"><AlignLeftOutlined /></Radio.Button>
                        <Radio.Button value="center"><AlignCenterOutlined /></Radio.Button>
                        <Radio.Button value="right"><AlignRightOutlined /></Radio.Button>
                    </Radio.Group>
                </Form.Item>
            </Form>
        ) : (
            <div style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>
                <DragOutlined style={{ fontSize: 24, marginBottom: 10 }} />
                <p>Select an item to edit</p>
            </div>
        )}
      </Sider>
    </Layout>
  );
};

export default VisualTemplateEditor;