import React, { useEffect, useState } from "react";
import {
  Drawer, Form, Button, Col, Row, Input, Select, InputNumber, Tabs, Card, 
  Space, Switch, Divider, message, ColorPicker, Spin
} from "antd";
import {
  SaveOutlined, LayoutOutlined, FileWordOutlined, TableOutlined,
  ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, PlusOutlined
} from "@ant-design/icons";
import { useDispatch } from "react-redux";
// Ensure these API calls are correctly imported
import { createTemplate, updateTemplate, getTemplateById, getTemplateConfig } from "../redux/apiCalls";
import RichTextEditor from "./RichTextEditor";
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  ReloadOutlined, 
  CompressOutlined 
} from "@ant-design/icons";


const { Option } = Select;

// --- 1. INTERNAL VISUAL HELPER COMPONENT ---
const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Thermal80mm: { width: 80, height: 297 },
};

const PaperWrapper = ({ children, form, label }) => {
  const pageSize = Form.useWatch("pageSize", form) || "A4";
  const orientation = Form.useWatch("orientation", form) || "portrait";
  const margins = Form.useWatch("margins", form) || { top: 10, right: 10, bottom: 10, left: 10 };

  // -- NEW: Zoom State --
  const [scale, setScale] = useState(0.75); // Default to 75% so it fits most screens initially

  const baseDim = PAPER_SIZES[pageSize] || PAPER_SIZES["A4"];
  const isLandscape = orientation === "landscape" && pageSize !== "Thermal80mm";
  
  const paperWidth = isLandscape ? baseDim.height : baseDim.width;
  const paperHeight = isLandscape ? baseDim.width : baseDim.height;
  
  const isFooter = label?.toLowerCase().includes("footer");

  // --- STYLES ---
  const containerStyle = {
    background: "#525659",
    padding: "40px",
    height: "100%",
    minHeight: "500px",
    overflow: "auto",      
    display: "flex",       
    alignItems: "flex-start", 
    justifyContent: "center", // Center the scaled paper horizontally
    borderRadius: "4px",
    border: "1px solid #d9d9d9",
    position: "relative"
  };

  const wrapperInnerStyle = {
    position: "relative",
    // SCALE APPLIED HERE
    transform: `scale(${scale})`,
    transformOrigin: "top center", // Scales from top-center so it doesn't jump around
    transition: "transform 0.2s ease", // Smooth zooming
    
    // Key fix: layout still calculates space based on original size.
    // We add margin-bottom to compensate for the "ghost" height if we scale down, 
    // or let it grow if we scale up.
    marginBottom: scale < 1 ? `-${(paperHeight * (1 - scale))}mm` : 0, 
    flexShrink: 0 
  };

  const paperStyle = {
    width: `${paperWidth}mm`,
    height: `${paperHeight}mm`,
    background: "white",
    boxShadow: "0 0 10px rgba(0,0,0,0.5)",
    position: "relative",
    paddingTop: `${margins.top || 0}mm`,
    paddingBottom: `${margins.bottom || 0}mm`,
    paddingLeft: `${margins.left || 0}mm`,
    paddingRight: `${margins.right || 0}mm`,
    boxSizing: "border-box",
    overflow: "hidden" 
  };

  const toolbarStyle = {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    borderRadius: '20px',
    padding: '4px 8px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  };

  const btnStyle = {
    color: '#fff',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '16px'
  };

  const innerContentStyle = {
    position: 'relative',
    zIndex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: isFooter ? 'flex-end' : 'flex-start'
  };

  const watermarkStyle = {
    position: 'absolute', top: '50%', left: '50%', 
    transform: 'translate(-50%, -50%) rotate(-45deg)', 
    fontSize: '40px', color: 'rgba(0,0,0,0.05)', 
    pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap'
  };

  const labelBadgeStyle = {
    position: "absolute", 
    top: -25, 
    left: 0, 
    color: "#fff", 
    fontSize: "12px", 
    whiteSpace: "nowrap"
  };

  // Zoom Handlers
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.3));
  const handleReset = () => setScale(1);
  const handleFit = () => setScale(0.65); // A nice "view all" size

  return (
    <div style={containerStyle} className="paper-scroll-container">
      
      {/* ZOOM TOOLBAR */}
      <div style={toolbarStyle}>
         <Button type="text" size="small" icon={<CompressOutlined />} style={btnStyle} onClick={handleFit} title="Fit to View" />
         <Button type="text" size="small" icon={<ZoomOutOutlined />} style={btnStyle} onClick={handleZoomOut} />
         <span style={{ color: '#fff', fontSize: '12px', minWidth: '35px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
         </span>
         <Button type="text" size="small" icon={<ZoomInOutlined />} style={btnStyle} onClick={handleZoomIn} />
         <Button type="text" size="small" icon={<ReloadOutlined />} style={btnStyle} onClick={handleReset} title="Reset 100%" />
      </div>

      <div style={wrapperInnerStyle}>
        
        {/* Label above the paper */}
        <div style={labelBadgeStyle}>
          {label} — {pageSize} ({paperWidth}mm x {paperHeight}mm)
        </div>

        {/* The Paper Itself */}
        <div style={paperStyle}>
           <div style={watermarkStyle}>{label} Area</div>
           <div style={innerContentStyle}>
              {children}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- 2. MAIN COMPONENT ---
const TemplateEditorDrawer = ({ open, onClose, templateId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const isEdit = !!templateId;
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [config, setConfig] = useState({ variables: [], tableKeys: [] });

  // Watchers for dynamic rendering
  const selectedType = Form.useWatch("type", form);

  // 1. Fetch Config (Variables/Keys)
  useEffect(() => {
    const fetchConfig = async () => {
      // Assuming this API exists based on your context. 
      // If not, use static arrays for variables/tableKeys.
      try {
        const typeToFetch = selectedType || "BILL";
        const data = await getTemplateConfig(typeToFetch); 
        if (data) setConfig(data);
      } catch (err) {
        console.warn("Config fetch failed, using defaults");
        // Fallbacks
        setConfig({
            variables: [
                { label: "Institution Name", value: "{{institution.name}}" },
                { label: "Patient Name", value: "{{patient.name}}" },
                { label: "Date", value: "{{date}}" }
            ],
            tableKeys: [
                { label: "Item Name", value: "name" },
                { label: "Price", value: "price" },
                { label: "Qty", value: "qty" },
                { label: "Total", value: "total" }
            ]
        });
      }
    };
    if (open) fetchConfig();
  }, [open, selectedType]);

  // 2. Fetch Template Data
  useEffect(() => {
    if (open) {
      form.resetFields();
      if (isEdit) {
        fetchData();
      } else {
        // Defaults matching provider frontend
        form.setFieldsValue({
          name: "New Template",
          category: "PRINT",
          type: "BILL",
          pageSize: "A4",
          orientation: "portrait",
          margins: { top: 10, bottom: 10, left: 10, right: 10 },
          content: {
            accentColor: "#007bff",
            fontFamily: "Roboto",
            showLogo: true,
            showInstitutionDetails: true,
            showQrCode: true,
            tableStructure: {
                showHead: true,
                density: "normal",
                columns: [
                    { id: "1", label: "#", dataKey: "index", width: "5%", align: "center", visible: true },
                    { id: "2", label: "Description", dataKey: "name", width: "55%", align: "left", visible: true },
                    { id: "3", label: "Price", dataKey: "price", width: "20%", align: "right", visible: true },
                    { id: "4", label: "Total", dataKey: "total", width: "20%", align: "right", visible: true },
                ],
                summarySettings: { showTax: true, showDiscount: true, showDues: true }
            }
          }
        });
      }
    }
    // eslint-disable-next-line
  }, [open, templateId]);

  const fetchData = async () => {
    setFetching(true);
    const data = await getTemplateById(dispatch, templateId);
    setFetching(false);
    if (data) {
        // Ensure data structure matches the Form (nested 'content', 'margins')
        // If your API returns flat data, you might need to reconstruct the object here
        const formData = {
            ...data,
            ...data.printDetails, // Handle case where provider stores inside printDetails
            content: data.printDetails?.content || data.content || {},
        };
        form.setFieldsValue(formData);
    } else {
        onClose();
    }
  };

  const onFinish = async () => {
    try {
        const values = await form.validateFields();
        setLoading(true);
        
        // Handle Color Object (AntD 5 returns object, API needs string)
        const colorHex = typeof values.content?.accentColor === "object"
            ? values.content.accentColor.toHexString()
            : values.content?.accentColor;

        // Process Columns (Ensure IDs exist)
        const formColumns = values.content?.tableStructure?.columns || [];
        const processedColumns = formColumns.map((col) => ({
            ...col,
            id: col.id || `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        }));

        const payload = {
            name: values.name,
            description: values.description,
            category: values.category || "PRINT",
            type: values.type,
            pageSize: values.pageSize,
            orientation: values.orientation,
            margins: values.margins,
            content: {
                ...values.content,
                accentColor: colorHex,
                tableStructure: {
                    ...(values.content?.tableStructure || {}),
                    columns: processedColumns,
                }
            }
        };

        let res;
        if (isEdit) {
            res = await updateTemplate(dispatch, templateId, payload);
        } else {
            res = await createTemplate(dispatch, payload);
        }

        setLoading(false);
        if (res?.status === 200 || res?.status === 201 || res?.success) {
            message.success("Template Saved Successfully");
            onSuccess();
            onClose();
        } else {
            message.error("Failed to save template");
        }
    } catch (error) {
        console.error("Validation Error", error);
        setLoading(false);
    }
  };

  return (
    <Drawer
      title={isEdit ? "Edit Template (Super Admin)" : "Create New Template (Super Admin)"}
      width="100%" // FULL SCREEN
      onClose={onClose}
      open={open}
      maskClosable={false}
      bodyStyle={{ paddingBottom: 80, background: "#f0f2f5" }}
      extra={
          <Button type="primary" size="large" icon={<SaveOutlined />} loading={loading} onClick={onFinish}>
              Save Template
          </Button>
      }
    >
      {fetching ? <div style={{textAlign:'center', marginTop: 50}}><Spin size="large"/></div> : (
      <Form layout="vertical" form={form}>
        <div style={{ maxWidth: 1600, margin: "0 auto" }}>
            <Tabs defaultActiveKey="settings" items={[
                // TAB 1: SETTINGS
                {
                    key: "settings",
                    label: <span><LayoutOutlined /> Page Settings</span>,
                    children: (
                        <Card>
                            <Row gutter={24}>
                                <Col span={8}><Form.Item name="name" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                <Col span={8}><Form.Item name="type" label="Type" rules={[{ required: true }]}><Select><Option value="BILL">Bill</Option><Option value="LAB_REPORT">Lab Report</Option><Option value="PRESCRIPTION">Prescription</Option></Select></Form.Item></Col>
                                <Col span={8}><Form.Item name="pageSize" label="Page Size"><Select><Option value="A4">A4</Option><Option value="A5">A5</Option><Option value="Thermal80mm">Thermal</Option></Select></Form.Item></Col>
                            </Row>
                            <Row gutter={24}>
                                <Col span={8}><Form.Item name="orientation" label="Orientation"><Select><Option value="portrait">Portrait</Option><Option value="landscape">Landscape</Option></Select></Form.Item></Col>
                                <Col span={16}>
                                    <Form.Item label="Margins (mm)">
                                        <div style={{ display: "flex", gap: 10 }}>
                                            <Form.Item name={["margins", "top"]} noStyle><InputNumber addonBefore="T" style={{ width: "100%" }} /></Form.Item>
                                            <Form.Item name={["margins", "bottom"]} noStyle><InputNumber addonBefore="B" style={{ width: "100%" }} /></Form.Item>
                                            <Form.Item name={["margins", "left"]} noStyle><InputNumber addonBefore="L" style={{ width: "100%" }} /></Form.Item>
                                            <Form.Item name={["margins", "right"]} noStyle><InputNumber addonBefore="R" style={{ width: "100%" }} /></Form.Item>
                                        </div>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                    )
                },
                // TAB 2: DESIGN EDITOR (With Visual Preview)
                {
                    key: "design",
                    label: <span><FileWordOutlined /> Design Editor</span>,
                    children: (
                        <Row gutter={24}>
                            {/* Visual Options */}
                            <Col span={24}>
                                <Card title="Visual Options" size="small">
                                    <Row gutter={16}>
                                        <Col span={6}><Form.Item name={["content", "accentColor"]} label="Brand Color"><ColorPicker showText /></Form.Item></Col>
                                        <Col span={6}><Form.Item name={["content", "fontFamily"]} label="Font"><Select><Option value="Roboto">Roboto</Option><Option value="Open Sans">Open Sans</Option></Select></Form.Item></Col>
                                        <Col span={12}>
                                            <div style={{ paddingTop: 30, display: "flex", gap: 10 }}>
                                                <Form.Item name={["content", "showLogo"]} valuePropName="checked" noStyle><Switch checkedChildren="Logo On" unCheckedChildren="Logo Off" /></Form.Item>
                                                <Form.Item name={["content", "showQrCode"]} valuePropName="checked" noStyle><Switch checkedChildren="QR On" unCheckedChildren="QR Off" /></Form.Item>
                                                <Form.Item name={["content", "showInstitutionDetails"]} valuePropName="checked" noStyle><Switch checkedChildren="Info On" unCheckedChildren="Info Off" /></Form.Item>
                                            </div>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                            {/* Header Editor */}
                            <Col span={12}>
                                <Card size="small" title="Header Design" style={{ padding: 20, marginTop: 16 }}>
                                    <PaperWrapper form={form} label="Header">
                                        <Form.Item name={["content", "headerHtml"]} noStyle>
                                            <RichTextEditor placeholder="Design your header..." availableVariables={config.variables} />
                                        </Form.Item>
                                    </PaperWrapper>
                                </Card>
                            </Col>
                            {/* Footer Editor */}
                            <Col span={12}>
                                <Card size="small" title="Footer Design" style={{ padding: 20, marginTop: 16 }}>
                                    <PaperWrapper form={form} label="Footer">
                                        <Form.Item name={["content", "footerHtml"]} noStyle>
                                            <RichTextEditor placeholder="Design your footer..." availableVariables={config.variables} />
                                        </Form.Item>
                                    </PaperWrapper>
                                </Card>
                            </Col>
                            
                        
                        </Row>
                    )
                },
                // TAB 3: TABLE & DATA (Full Column Config)
                {
                    key: "table",
                    label: <span><TableOutlined /> Table & Data</span>,
                    children: (
                        <Row gutter={24}>
                            <Col span={8}>
                                <Card size="small" title="Table Appearance" style={{ marginBottom: 16 }}>
                                    <Row gutter={16}>
                                        <Col span={24}><Form.Item name={["content", "tableStructure", "density"]} label="Density"><Select><Option value="compact">Compact</Option><Option value="normal">Normal</Option><Option value="spacious">Spacious</Option></Select></Form.Item></Col>
                                        <Col span={12}><Form.Item name={["content", "tableStructure", "showHead"]} label="Show Header" valuePropName="checked"><Switch /></Form.Item></Col>
                                        <Col span={12}><Form.Item name={["content", "tableStructure", "striped"]} label="Zebra Stripes" valuePropName="checked"><Switch /></Form.Item></Col>
                                    </Row>
                                </Card>
                                <Card size="small" title="Financial Summary">
                                    <Row>
                                        <Col span={12}><Form.Item name={["content", "tableStructure", "summarySettings", "showTax"]} valuePropName="checked" label="Tax"><Switch /></Form.Item></Col>
                                        <Col span={12}><Form.Item name={["content", "tableStructure", "summarySettings", "showDiscount"]} valuePropName="checked" label="Discount"><Switch /></Form.Item></Col>
                                        <Col span={12}><Form.Item name={["content", "tableStructure", "summarySettings", "showDues"]} valuePropName="checked" label="Dues"><Switch /></Form.Item></Col>
                                    </Row>
                                </Card>
                            </Col>

                            <Col span={16}>
                                <Card size="small" title="Columns Configuration">
                                    <div style={{ display: "flex", marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#888" }}>
                                        <div style={{ width: 40, textAlign: "center" }}>Sort</div>
                                        <div style={{ width: 44, textAlign: "center" }}>Show</div>
                                        <div style={{ width: 150, marginLeft: 8 }}>Column Title</div>
                                        <div style={{ width: 150, marginLeft: 8 }}>Data Key</div>
                                        <div style={{ width: 80, marginLeft: 8 }}>Width</div>
                                        <div style={{ width: 90, marginLeft: 8 }}>Align</div>
                                    </div>
                                    <Form.List name={["content", "tableStructure", "columns"]}>
                                        {(fields, { add, remove, move }) => (
                                        <>
                                            {fields.map((field, index) => (
                                            <Space key={field.key} style={{ display: "flex", marginBottom: 8 }} align="center">
                                                <Form.Item {...field} name={[field.name, "id"]} hidden><Input /></Form.Item>
                                                <Space direction="vertical" size={0} style={{ width: 40 }}>
                                                    <Button size="small" type="text" icon={<ArrowUpOutlined style={{ fontSize: 10 }} />} onClick={() => move(index, index - 1)} disabled={index === 0} />
                                                    <Button size="small" type="text" icon={<ArrowDownOutlined style={{ fontSize: 10 }} />} onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} />
                                                </Space>
                                                <Form.Item {...field} name={[field.name, "visible"]} valuePropName="checked" noStyle><Switch size="small" /></Form.Item>
                                                <Form.Item {...field} name={[field.name, "label"]} noStyle rules={[{ required: true }]}><Input placeholder="Title" style={{ width: 150 }} /></Form.Item>
                                                <Form.Item {...field} name={[field.name, "dataKey"]} noStyle rules={[{ required: true }]}>
                                                    <Select style={{ width: 150 }} placeholder="Select Data">
                                                        {config.tableKeys.map((k) => (<Option key={k.value} value={k.value}>{k.label}</Option>))}
                                                    </Select>
                                                </Form.Item>
                                                <Form.Item {...field} name={[field.name, "width"]} noStyle><Input placeholder="%" style={{ width: 80 }} /></Form.Item>
                                                <Form.Item {...field} name={[field.name, "align"]} noStyle><Select style={{ width: 90 }}><Option value="left">Left</Option><Option value="center">Center</Option><Option value="right">Right</Option></Select></Form.Item>
                                                <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                            </Space>
                                            ))}
                                            <Button type="dashed" onClick={() => add({ visible: true, width: "auto", align: "left" })} block icon={<PlusOutlined />}>Add Column</Button>
                                        </>
                                        )}
                                    </Form.List>
                                </Card>
                            </Col>
                        </Row>
                    )
                }
            ]} />
        </div>
      </Form>
      )}
    </Drawer>
  );
};

export default TemplateEditorDrawer;