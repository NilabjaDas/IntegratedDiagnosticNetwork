import React, { useState } from 'react';
import { Modal, Steps, Button, Form, Input, Switch, InputNumber, Space, DatePicker } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { updateInstitution } from '../services/api';
import { toast } from 'react-toastify';
import moment from 'moment';

const { Step } = Steps;

const EditInstitutionWizard = ({ open, onCancel, onOk, institution }) => {
    const [current, setCurrent] = useState(0);
    const [form] = Form.useForm();

    if (!institution) {
        return null;
    }

    // Convert date strings to moment objects for the DatePicker
    if (institution.plan) {
        if (institution.plan.trialEndsAt) {
            institution.plan.trialEndsAt = moment(institution.plan.trialEndsAt);
        }
        if (institution.plan.expiresAt) {
            institution.plan.expiresAt = moment(institution.plan.expiresAt);
        }
    }


    const steps = [
        {
            title: 'Identity',
            content: (
                <>
                    <Form.Item name="institutionName" label="Institution Name" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="primaryDomain" label="Primary Domain" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="brandName" label="Brand Name"><Input /></Form.Item>
                    <Form.Item name="onboardingStatus" label="Onboarding Status"><Input /></Form.Item>
                </>
            ),
        },
        {
            title: 'Contact',
            content: (
                <>
                    <Form.Item name={['contact', 'phone']} label="Contact Phone"><Input /></Form.Item>
                    <Form.Item name={['contact', 'altPhone']} label="Alternate Phone"><Input /></Form.Item>
                    <Form.Item name={['contact', 'email']} label="Contact Email"><Input type="email" /></Form.Item>
                    <Form.Item name={['contact', 'supportEmail']} label="Support Email"><Input type="email" /></Form.Item>
                </>
            ),
        },
        {
            title: 'Address',
            content: (
                <>
                    <Form.Item name={['address', 'line1']} label="Address Line 1"><Input /></Form.Item>
                    <Form.Item name={['address', 'line2']} label="Address Line 2"><Input /></Form.Item>
                    <Form.Item name={['address', 'city']} label="City"><Input /></Form.Item>
                    <Form.Item name={['address', 'state']} label="State"><Input /></Form.Item>
                    <Form.Item name={['address', 'pincode']} label="Pincode"><Input /></Form.Item>
                    <Form.Item name={['address', 'country']} label="Country"><Input /></Form.Item>
                </>
            )
        },
        {
            title: 'Branding',
            content: (
                <>
                    <Form.Item name="loginPageImgUrl" label="Login Page Image URL"><Input /></Form.Item>
                    <Form.Item name="institutionLogoUrl" label="Institution Logo URL"><Input /></Form.Item>
                    <Form.Item name="favicon" label="Favicon URL"><Input /></Form.Item>
                    <Form.Item name={['theme', 'primaryColor']} label="Primary Color"><Input type="color" /></Form.Item>
                    <Form.Item name={['theme', 'secondaryColor']} label="Secondary Color"><Input type="color" /></Form.Item>
                </>
            )
        },
        {
            title: 'Billing & Plan',
            content: (
                <>
                    <Form.Item name={['billing', 'gstin']} label="GSTIN"><Input /></Form.Item>
                    <Form.Item name={['billing', 'pan']} label="PAN"><Input /></Form.Item>
                    <Form.Item name={['billing', 'invoicePrefix']} label="Invoice Prefix"><Input /></Form.Item>
                    <Form.Item name={['billing', 'taxPercentage']} label="Tax Percentage"><InputNumber min={0} max={100} /></Form.Item>
                    <Form.Item name={['billing', 'defaultCurrency']} label="Default Currency"><Input /></Form.Item>
                    <Form.Item name={['plan', 'name']} label="Plan Name"><Input /></Form.Item>
                    <Form.Item name={['plan', 'tier']} label="Plan Tier"><Input /></Form.Item>
                    <Form.Item name={['plan', 'isTrial']} label="Trial" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name={['plan', 'trialEndsAt']} label="Trial Ends At"><DatePicker showTime /></Form.Item>
                    <Form.Item name={['plan', 'expiresAt']} label="Expires At"><DatePicker showTime /></Form.Item>
                </>
            )
        },
        {
            title: 'Features & Settings',
            content: (
                 <>
                    <Form.Item name={['features', 'hasRadiology']} label="Radiology" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name={['features', 'hasPACS']} label="PACS" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name={['features', 'hasHomeCollection']} label="Home Collection" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name={['features', 'hasTeleReporting']} label="Tele-Reporting" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name={['settings', 'timezone']} label="Timezone"><Input /></Form.Item>
                    <Form.Item name={['settings', 'locale']} label="Locale"><Input /></Form.Item>
                 </>
            )
        },
        {
            title: 'Outlets',
            content: (
                <Form.List name="outlets">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, fieldKey, ...restField }) => (
                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                    <Form.Item {...restField} name={[name, 'name']} fieldKey={[fieldKey, 'name']} rules={[{ required: true, message: 'Missing outlet name' }]}><Input placeholder="Outlet Name" /></Form.Item>
                                    <Form.Item {...restField} name={[name, 'code']} fieldKey={[fieldKey, 'code']}><Input placeholder="Outlet Code" /></Form.Item>
                                    <MinusCircleOutlined onClick={() => remove(name)} />
                                </Space>
                            ))}
                            <Form.Item>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                    Add Outlet
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>
            )
        }
    ];

    const next = () => setCurrent(current + 1);
    const prev = () => setCurrent(current - 1);

    return (
        <Modal
            title="Edit Institution"
            open={open}
            onCancel={onCancel}
            width={800}
            footer={
                <div style={{ marginTop: 24, textAlign: 'right' }}>
                    <Button key="back" onClick={onCancel}>
                        Cancel
                    </Button>
                    {current > 0 && (
                        <Button style={{ margin: '0 8px' }} onClick={prev}>
                            Previous
                        </Button>
                    )}
                    {current < steps.length - 1 && (
                        <Button type="primary" onClick={next}>
                            Next
                        </Button>
                    )}
                    {current === steps.length - 1 && (
                        <Button type="primary" onClick={() => form.submit()}>
                            Save Changes
                        </Button>
                    )}
                </div>
            }
        >
            <Steps current={current} size="small">
                {steps.map(item => (
                    <Step key={item.title} title={item.title} />
                ))}
            </Steps>
            <div className="steps-content" style={{ marginTop: 24, maxHeight: '60vh', overflowY: 'auto' }}>
                <Form form={form} layout="vertical" initialValues={institution} onFinish={async (values) => {
                    try {
                        await updateInstitution(institution.institutionId, values);
                        toast.success("Institution updated successfully");
                        onOk();
                    } catch (error) {
                        toast.error("Failed to update institution");
                    }
                }}>
                    {steps.map((step, index) => (
                        <div key={index} style={{ display: index === current ? 'block' : 'none' }}>
                            {step.content}
                        </div>
                    ))}
                </Form>
            </div>
        </Modal>
    );
};

export default EditInstitutionWizard;
