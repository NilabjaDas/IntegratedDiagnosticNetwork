import React, { useState, useEffect } from "react";
import {
  Card, Row, Col, Form, Input, Select, Switch, Button,
  List, Tag, Divider, ColorPicker, InputNumber, Tabs, Modal, Spin, Space, Tooltip,
} from "antd";
import {
  PlusOutlined, FormOutlined, DeleteOutlined,
  ExclamationCircleOutlined, SaveOutlined, TableOutlined,
  FileWordOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from "@ant-design/icons";
import RichTextEditor from "./RichTextEditor";
import { getTemplateConfig } from "../redux/apiCalls";

const { Option } = Select;
const { confirm } = Modal;

// Paper Dimensions in Millimeters (mm)
const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Thermal80mm: { width: 80, height: 297 }, // Thermal usually has infinite height, but we set a display height
};

const PaperWrapper = ({ children, form, label }) => {
  // 1. Watch form values in real-time
  const pageSize = Form.useWatch("pageSize", form) || "A4";
  const orientation = Form.useWatch("orientation", form) || "portrait";
  const margins = Form.useWatch("margins", form) || { top: 10, right: 10, bottom: 10, left: 10 };

  // 2. Calculate Dimensions
  const baseDim = PAPER_SIZES[pageSize] || PAPER_SIZES["A4"];
  const isLandscape = orientation === "landscape" && pageSize !== "Thermal80mm";

  const paperWidth = isLandscape ? baseDim.height : baseDim.width;
  const paperHeight = isLandscape ? baseDim.width : baseDim.height;

  // 3. Determine Alignment (Header = Top, Footer = Bottom)
  const isFooter = label?.toLowerCase().includes("footer");

  // 4. Styles
  const containerStyle = {
    background: "#525659", 
    padding: "40px",
    overflow: "auto", 
    display: "flex",
    justifyContent: "center",
    borderRadius: "4px",
    marginBottom: "16px",
    border: "1px solid #d9d9d9",
    // maxHeight: "600px" 
  };

  const paperStyle = {
    // --- EXACT DIMENSIONS ---
    width: `${paperWidth}mm`,
    height: `${paperHeight}mm`, 
    
    background: "white",
    boxShadow: "0 0 10px rgba(0,0,0,0.5)",
    position: "relative",
    
    // --- MARGIN SIMULATION ---
    paddingTop: `${margins.top || 0}mm`,
    paddingBottom: `${margins.bottom || 0}mm`,
    paddingLeft: `${margins.left || 0}mm`,
    paddingRight: `${margins.right || 0}mm`,
    
    boxSizing: "border-box", 
    overflow: "hidden" 
  };

  // --- NEW: Inner Container to handle vertical alignment ---
  const innerContentStyle = {
      position: 'relative', 
      zIndex: 1, 
      height: '100%', 
      display: 'flex',
      flexDirection: 'column',
      // If it's a footer, push content to the bottom
      justifyContent: isFooter ? 'flex-end' : 'flex-start' 
  };

  const labelStyle = {
    position: "absolute",
    top: -25,
    left: 0,
    color: "#fff",
    fontSize: 12,
    fontWeight: 500,
  };

  const watermarkStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: '40px',
    color: 'rgba(0,0,0,0.05)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    fontWeight: 'bold',
    zIndex: 0
  };

  return (
    <div style={containerStyle}>
      <div style={{ position: "relative" }}>
        <div style={labelStyle}>
          {label} — {pageSize} ({paperWidth}mm x {paperHeight}mm)
        </div>
        
        <div style={paperStyle} className="print-simulation">
           <div style={watermarkStyle}>{label} Area</div>
           
           {/* Apply Flexbox Alignment here */}
           <div style={innerContentStyle}>
              {children}
           </div>
        </div>
      </div>
    </div>
  );
};
const BillingTemplateEditor = ({ templates, onCreate, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ variables: [], tableKeys: [] });
  const [form] = Form.useForm();
  const selectedType = Form.useWatch("type", form);

  useEffect(() => {
    const fetchConfig = async () => {
      const data = await getTemplateConfig();
      setConfig(data);
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      const typeToFetch = selectedType || "BILL";
      const data = await getTemplateConfig(typeToFetch);
      if (data) setConfig(data);
    };
    if (selectedType) fetchConfig();
  }, [selectedType]);

  useEffect(() => {
    if (
      editingId &&
      !templates.find((t) => t.templateId === editingId) &&
      !templates.find((t) => t._id === editingId)
    ) {
      setEditingId(null);
      form.resetFields();
    }
  }, [templates, editingId, form]);

  const filteredTemplates = templates.filter((t) => {
    const type = t.printDetails?.type || t.type;
    return filterType === "ALL" ? true : type === filterType;
  });

  const handleEdit = (template) => {
    setEditingId(template._id);
    const formData = {
      ...template,
      ...template.printDetails,
      content: template.printDetails?.content || template.content || {},
    };
    form.setFieldsValue(formData);
  };

  const handleCreateClick = async () => {
    setLoading(true);
    const newTemplatePayload = {
      name: "New Template",
      category: "PRINT",
      isDefault: false,
      printDetails: {
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
          headerHtml: "<h1>{{institution.name}}</h1>",
          footerHtml: "<p>Generated by System</p>",
          tableStructure: {
            showHead: true,
            density: "normal",
            striped: false,
            columns: [
              { id: "1", label: "#", dataKey: "index", width: "5%", align: "center", visible: true },
              { id: "2", label: "Description", dataKey: "name", width: "55%", align: "left", visible: true },
              { id: "3", label: "Price", dataKey: "price", width: "20%", align: "right", visible: true },
              { id: "4", label: "Total", dataKey: "total", width: "20%", align: "right", visible: true },
            ],
            summarySettings: {
              showTax: true, showDiscount: true, showDues: true, wordsAmount: true,
            },
          },
        },
      },
      commDetails: { triggerEvent: "NONE" },
    };

    const createdTemplate = await onCreate(newTemplatePayload);
    setLoading(false);
    if (createdTemplate) handleEdit(createdTemplate);
  };

  const handleSaveClick = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const currentTemplate = templates.find((t) => t._id === editingId) || {};
      const existingPrintDetails = currentTemplate.printDetails || {};
      const existingContent = existingPrintDetails.content || {};

      const colorHex =
        typeof values.content?.accentColor === "object"
          ? values.content.accentColor.toHexString()
          : values.content?.accentColor;

      const formColumns =
        values.content?.tableStructure?.columns ||
        existingContent.tableStructure?.columns ||
        [];
      const processedColumns = formColumns.map((col) => ({
        ...col,
        id: col.id || `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      const apiPayload = {
        institutionId: values.institutionId || currentTemplate.institutionId,
        name: values.name,
        category: "PRINT",
        isDefault:
          values.isDefault !== undefined
            ? values.isDefault
            : currentTemplate.isDefault,
        printDetails: {
          type: values.type,
          pageSize: values.pageSize,
          orientation: values.orientation,
          margins: values.margins || existingPrintDetails.margins,
          content: {
            ...existingContent,
            ...values.content,
            accentColor: colorHex,
            tableStructure: {
              ...(existingContent.tableStructure || {}),
              ...(values.content?.tableStructure || {}),
              columns: processedColumns,
            },
          },
        },
      };

      await onUpdate(editingId, apiPayload);
      setLoading(false);
    } catch (error) {
      console.error("Validation Failed:", error);
      setLoading(false);
    }
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    confirm({
      title: "Delete Template?",
      icon: <ExclamationCircleOutlined />,
      okText: "Yes, Delete",
      okType: "danger",
      onOk() {
        if (editingId === id) {
          setEditingId(null);
          form.resetFields();
        }
        onDelete(id);
      },
    });
  };

  return (
    <Row gutter={24} style={{ height: "100%" }}>
      {/* LEFT: LIST */}
      <Col span={4} style={{ borderRight: "1px solid #f0f0f0", minHeight: "75vh" }}>
        <div style={{ marginBottom: 16 }}>
          <Button block type="dashed" icon={<PlusOutlined />} onClick={handleCreateClick} loading={loading} style={{ marginBottom: 10 }}>
            Create New Template
          </Button>
          <Select defaultValue="ALL" style={{ width: "100%" }} onChange={setFilterType}>
            <Option value="ALL">All Types</Option>
            <Option value="BILL">Bills</Option>
            <Option value="LAB_REPORT">Lab Reports</Option>
            <Option value="PRESCRIPTION">Prescriptions</Option>
          </Select>
        </div>
        <List
          dataSource={filteredTemplates}
          renderItem={(item) => (
            <List.Item
              actions={[<Button key="del" type="text" danger size="small" icon={<DeleteOutlined />} onClick={(e) => handleDeleteClick(e, item._id)} />]}
              style={{
                background: item._id === editingId ? "#e6f7ff" : "white",
                border: item._id === editingId ? "1px solid #1890ff" : "1px solid #f0f0f0",
                padding: "10px", borderRadius: 6, marginBottom: 8, cursor: "pointer",
              }}
              onClick={() => handleEdit(item)}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: 500 }}>{item.name}</span>}
                description={
                  <div style={{ fontSize: 11 }}>
                    <Tag color="blue">{item.printDetails?.type}</Tag>
                    {item.isDefault && <Tag color="green">Default</Tag>}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Col>

      {/* RIGHT: EDITOR */}
      <Col span={20}>
        {editingId ? (
          <Form layout="vertical" form={form}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15, borderBottom: "1px solid #eee", paddingBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: "bold" }}>Editing Template</span>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveClick} loading={loading}>Save Changes</Button>
            </div>

            <Form.Item name="institutionId" hidden><Input /></Form.Item>
            <Form.Item name="templateId" hidden><Input /></Form.Item>

            <Tabs defaultActiveKey="settings" items={[
                {
                  key: "settings",
                  forceRender: true,
                  label: <span><FormOutlined /> Page Settings</span>,
                  children: (
                    <Card size="small">
                      <Row gutter={16}>
                        <Col span={12}><Form.Item name="name" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="category" label="Category"><Input disabled defaultValue="PRINT" /></Form.Item></Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={8}><Form.Item name="type" label="Template Type" rules={[{ required: true }]}><Select><Option value="BILL">Bill</Option><Option value="LAB_REPORT">Lab Report</Option></Select></Form.Item></Col>
                        <Col span={8}><Form.Item name="pageSize" label="Page Size"><Select><Option value="A4">A4</Option><Option value="A5">A5</Option><Option value="Thermal80mm">Thermal</Option></Select></Form.Item></Col>
                        <Col span={8}><Form.Item name="orientation" label="Orientation"><Select><Option value="portrait">Portrait</Option><Option value="landscape">Landscape</Option></Select></Form.Item></Col>
                      </Row>
                      <Row gutter={16}><Col span={8}><Form.Item name="isDefault" label="Set as Default" valuePropName="checked"><Switch /></Form.Item></Col></Row>
                      <Divider orientation="left">Margins (mm)</Divider>
                      <div style={{ display: "flex", gap: 10 }}>
                        <Form.Item name={["margins", "top"]} noStyle><InputNumber addonBefore="T" style={{ width: "100%" }} placeholder="0" /></Form.Item>
                        <Form.Item name={["margins", "right"]} noStyle><InputNumber addonBefore="R" style={{ width: "100%" }} placeholder="0" /></Form.Item>
                        <Form.Item name={["margins", "bottom"]} noStyle><InputNumber addonBefore="B" style={{ width: "100%" }} placeholder="0" /></Form.Item>
                        <Form.Item name={["margins", "left"]} noStyle><InputNumber addonBefore="L" style={{ width: "100%" }} placeholder="0" /></Form.Item>
                      </div>
                    </Card>
                  ),
                },
                {
                  key: "design",
                  forceRender: true,
                  label: <span><FileWordOutlined /> Design Editor</span>,
                  children: (
                    <div style={{ height: "65vh", overflowY: "auto" }}>
                      <Card size="small" title="Header Design" style={{ marginBottom: 16 }}>
                        <PaperWrapper form={form} label="Header">
                          <Form.Item name={["content", "headerHtml"]} noStyle>
                            <RichTextEditor placeholder="Design your header..." availableVariables={config.variables} />
                          </Form.Item>
                        </PaperWrapper>
                      </Card>

                      <Card size="small" title="Footer Design" style={{ marginBottom: 16 }}>
                        <PaperWrapper form={form} label="Footer">
                          <Form.Item name={["content", "footerHtml"]} noStyle>
                            <RichTextEditor placeholder="Design your footer..." availableVariables={config.variables} />
                          </Form.Item>
                        </PaperWrapper>
                      </Card>

                      <Divider>Visual Settings</Divider>
                      <Row gutter={16}>
                        <Col span={8}><Form.Item name={["content", "accentColor"]} label="Brand Color"><ColorPicker showText /></Form.Item></Col>
                        <Col span={8}><Form.Item name={["content", "fontFamily"]} label="Font"><Select><Option value="Roboto">Roboto</Option><Option value="Open Sans">Open Sans</Option></Select></Form.Item></Col>
                        <Col span={8}><div style={{ paddingTop: 30, display: "flex", gap: 10, flexWrap: "wrap" }}><Form.Item name={["content", "showLogo"]} valuePropName="checked" noStyle><Switch checkedChildren="Logo" unCheckedChildren="No Logo" /></Form.Item><Form.Item name={["content", "showQrCode"]} valuePropName="checked" noStyle><Switch checkedChildren="QR" unCheckedChildren="No QR" /></Form.Item><Form.Item name={["content", "showInstitutionDetails"]} valuePropName="checked" noStyle><Switch checkedChildren="Inst. Info" unCheckedChildren="No Inst. Info" /></Form.Item></div></Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: "table",
                  forceRender: true,
                  label: <span><TableOutlined /> Table & Data</span>,
                  children: (
                    <div style={{ height: "65vh", overflowY: "auto", paddingRight: 10 }}>
                      <Card size="small" title="Table Appearance" style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                          <Col span={8}><Form.Item name={["content", "tableStructure", "density"]} label="Density"><Select><Option value="compact">Compact</Option><Option value="normal">Normal</Option><Option value="spacious">Spacious</Option></Select></Form.Item></Col>
                          <Col span={8}><Form.Item name={["content", "tableStructure", "showHead"]} label="Show Header" valuePropName="checked"><Switch /></Form.Item></Col>
                          <Col span={8}><Form.Item name={["content", "tableStructure", "striped"]} label="Zebra Stripes" valuePropName="checked"><Switch /></Form.Item></Col>
                        </Row>
                      </Card>

                      <Card size="small" title="Columns Configuration" style={{ marginBottom: 16 }}>
                        {/* Column Editor Implementation (Same as previous) */}
                        <div style={{ display: "flex", marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#888" }}>
                          <div style={{ width: 40, textAlign: "center" }}>Sort</div>
                          <div style={{ width: 44, textAlign: "center" }}>Show</div>
                          <div style={{ width: 150, marginLeft: 8 }}>Column Title</div>
                          <div style={{ width: 150, marginLeft: 8 }}>Map Data Value</div>
                          <div style={{ width: 80, marginLeft: 8 }}>Width</div>
                          <div style={{ width: 90, marginLeft: 8 }}>Align</div>
                          <div style={{ width: 40 }}></div>
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
                                  <Form.Item {...field} name={[field.name, "dataKey"]} noStyle rules={[{ required: true }]}><Select style={{ width: 150 }} placeholder="Select Data">{config.tableKeys.map((k) => (<Option key={k.value} value={k.value}>{k.label}</Option>))}</Select></Form.Item>
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
                      <Card size="small" title="Financial Summary Settings">
                        <Row gutter={16}>
                          <Col span={6}><Form.Item name={["content", "tableStructure", "summarySettings", "showTax"]} valuePropName="checked" label="Tax"><Switch /></Form.Item></Col>
                          <Col span={6}><Form.Item name={["content", "tableStructure", "summarySettings", "showDiscount"]} valuePropName="checked" label="Discount"><Switch /></Form.Item></Col>
                          <Col span={6}><Form.Item name={["content", "tableStructure", "summarySettings", "showDues"]} valuePropName="checked" label="Dues"><Switch /></Form.Item></Col>
                          <Col span={6}><Form.Item name={["content", "tableStructure", "summarySettings", "wordsAmount"]} valuePropName="checked" label="Words"><Switch /></Form.Item></Col>
                        </Row>
                      </Card>
                    </div>
                  ),
                },
              ]}
            />
          </Form>
        ) : (
          <div style={{ textAlign: "center", marginTop: 100, color: "#ccc" }}>{loading ? <Spin /> : "Select a Template to Edit"}</div>
        )}
      </Col>
    </Row>
  );
};

export default BillingTemplateEditor;