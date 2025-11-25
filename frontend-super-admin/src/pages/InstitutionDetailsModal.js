import React, { useState } from 'react';
import { Modal, Form, Input, Button } from 'antd';
import { updateInstitution } from '../services/api';
import { toast } from 'react-toastify';

const InstitutionDetailsModal = ({ open, onCancel, onOk, institution }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    if (!institution) {
        return null;
    }

    const handleOk = async (values) => {
        setLoading(true);
        try {
            await updateInstitution(institution.institutionId, values);
            toast.success("Institution updated successfully");
            onOk();
        } catch (error) {
            toast.error("Failed to update institution");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Institution"
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="back" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button key="submit" type="primary" loading={loading} onClick={() => form.submit()}>
                    Save
                </Button>,
            ]}
        >
            <Form form={form} onFinish={handleOk} layout="vertical" initialValues={institution}>
                <Form.Item name="institutionName" label="Institution Name">
                    <Input />
                </Form.Item>
                <Form.Item name="primaryDomain" label="Primary Domain">
                    <Input />
                </Form.Item>
                <Form.Item name={['contact', 'phone']} label="Contact Phone">
                    <Input />
                </Form.Item>
                <Form.Item name={['contact', 'email']} label="Contact Email">
                    <Input />
                </Form.Item>
                 <Form.Item name={['address', 'line1']} label="Address Line 1">
                    <Input />
                </Form.Item>
                <Form.Item name={['address', 'city']} label="City">
                    <Input />
                </Form.Item>
                <Form.Item name={['address', 'state']} label="State">
                    <Input />
                </Form.Item>
                <Form.Item name={['address', 'pincode']} label="Pincode">
                    <Input />
                </Form.Item>
                <Form.Item name={['address', 'country']} label="Country">
                    <Input />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default InstitutionDetailsModal;
