import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Table, Card, Button, Modal, Input,
    Space, Statistic, Row, Col, Typography, Spin, Tag, Tooltip, Tabs, App
} from 'antd';
import {
    Database, Plus, Trash2, RefreshCw, Server, Search, FileText, HardDrive, LayoutDashboard
} from 'lucide-react';
import {
    getRawBuckets, createRawBucket, deleteRawBucket, getRawBucketStats, getRawGlobalStats,
    // getAccessKeys, createAccessKey, deleteAccessKey, AccessKey
} from '@/features/documents';
import { formatFileSize } from '@/utils/format';

const { Title, Text } = Typography;

interface Bucket {
    name: string;
    creationDate: string;
}

interface BucketStats {
    objectCount: number;
    totalSize: number;
    loading: boolean;
    loaded: boolean;
    error?: boolean;
}

const StoragePage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [loading, setLoading] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [creating, setCreating] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [bucketToDelete, setBucketToDelete] = useState<string | null>(null);
    const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [stats, setStats] = useState<Record<string, BucketStats>>({});
    const [searchText, setSearchText] = useState('');

    // Global metrics state
    const [globalMetrics, setGlobalMetrics] = useState<{
        totalObjects: number;
        totalSize: number;
        distribution?: Record<string, number>;
        topBuckets?: { name: string; size: number; objectCount: number }[];
        topFiles?: { name: string; size: number; lastModified: Date; bucketName: string }[];
    }>({ totalObjects: 0, totalSize: 0, distribution: {}, topBuckets: [], topFiles: [] });
    const [loadingMetrics, setLoadingMetrics] = useState(false);

    // Access Keys State
    /*
    const [accessKeys, setAccessKeys] = useState<AccessKey[]>([]);
    const [keysLoading, setKeysLoading] = useState(false);
    const [createKeyModalVisible, setCreateKeyModalVisible] = useState(false);
    const [creatingKey, setCreatingKey] = useState(false);
    const [generatedCredentials, setGeneratedCredentials] = useState<{ accessKey: string, secretKey: string } | null>(null);
    const [credsModalVisible, setCredsModalVisible] = useState(false);
    const [keyPolicy, setKeyPolicy] = useState('readwrite');
    const [keyName, setKeyName] = useState('');
    const [keyDesc, setKeyDesc] = useState('');
    */

    useEffect(() => {
        loadBuckets();
        // loadAccessKeys();
    }, []);

    const loadBuckets = async () => {
        setLoading(true);
        try {
            const data = await getRawBuckets();
            setBuckets(data);
            // Initialize empty stats for new buckets
            setStats(prevStats => {
                const newStats: Record<string, BucketStats> = {};
                data.forEach((b: any) => {
                    const existingStat = prevStats[b.name];
                    if (existingStat) {
                        newStats[b.name] = existingStat;
                    } else {
                        newStats[b.name] = { objectCount: 0, totalSize: 0, loading: false, loaded: false, error: false };
                    }
                });
                return newStats;
            });
        } catch (error) {
            message.error(t('storage.error.load'));
        } finally {
            setLoading(false);
        }
    };

    const loadGlobalStats = async () => {
        setLoadingMetrics(true);
        try {
            const data = await getRawGlobalStats();
            setGlobalMetrics({
                totalObjects: data.totalObjects,
                totalSize: data.totalSize,
                distribution: data.distribution,
                topBuckets: data.topBuckets,
                topFiles: data.topFiles
            });
            message.success(t('storage.sync.success'));
        } catch (error) {
            message.error(t('storage.sync.error'));
        } finally {
            setLoadingMetrics(false);
        }
    };

    /*
    const loadAccessKeys = async () => {
        setKeysLoading(true);
        try {
            const data = await getAccessKeys();
            setAccessKeys(data);
        } catch (error) {
            message.error(t('storage.keys.error.load'));
        } finally {
            setKeysLoading(false);
        }
    };
    
    const handleCreateKey = async () => {
        setCreatingKey(true);
        try {
            const result = await createAccessKey(keyPolicy, keyName, keyDesc);
            // MinIO admin response usually contains 'credentials' with 'accessKey' and 'secretKey'
            const creds = result.credentials || { accessKey: result.accessKey, secretKey: result.secretKey };
            setGeneratedCredentials(creds);
    
            setCreateKeyModalVisible(false);
            setCredsModalVisible(true);
            message.success(t('storage.keys.create.success'));
            loadAccessKeys();
    
            setKeyName('');
            setKeyDesc('');
        } catch (error) {
            message.error(t('storage.keys.create.error'));
        } finally {
            setCreatingKey(false);
        }
    };
    
    const handleDeleteKey = async (accessKey: string) => {
        try {
            await deleteAccessKey(accessKey);
            message.success(t('storage.keys.delete.success'));
            loadAccessKeys();
        } catch (error) {
            message.error(t('storage.keys.delete.error'));
        }
    };
    */

    /*
    const keyColumns = [
        {
            title: t('storage.keys.table.accessKey'),
            dataIndex: 'accessKey',
            key: 'accessKey',
            width: '40%',
        },
        {
            title: t('storage.keys.table.status'),
            dataIndex: 'accountStatus',
            key: 'accountStatus',
            render: (status: string) => (
                <Tag color={status === 'on' ? 'green' : 'red'}>{status ? status.toUpperCase() : 'UNKNOWN'}</Tag>
            )
        },
        {
            title: t('storage.keys.table.name'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('storage.keys.table.actions'),
            key: 'actions',
            render: (_: any, record: AccessKey) => (
                <Button
                    type="text"
                    danger
                    icon={<Trash2 size={16} />}
                    onClick={() => handleDeleteKey(record.accessKey)}
                />
            )
        }
    ];
    */

    const handleCreate = async () => {
        if (!newBucketName.trim()) return;
        setCreating(true);
        try {
            await createRawBucket(newBucketName);
            message.success(t('storage.create.success'));
            setCreateModalVisible(false);
            setNewBucketName('');
            loadBuckets();
        } catch (error) {
            message.error(t('storage.create.error'));
        } finally {
            setCreating(false);
        }
    };

    const openDeleteModal = (name: string) => {
        setBucketToDelete(name);
        setDeleteConfirmationName('');
        setDeleteModalVisible(true);
    };

    const handleDelete = async () => {
        if (!bucketToDelete || deleteConfirmationName !== bucketToDelete) return;

        setDeleting(true);
        try {
            await deleteRawBucket(bucketToDelete);
            message.success(t('storage.delete.success'));
            setDeleteModalVisible(false);
            setBucketToDelete(null);
            setDeleteConfirmationName('');
            loadBuckets();
        } catch (error) {
            message.error(t('storage.delete.error'));
        } finally {
            setDeleting(false);
        }
    };

    const loadBucketStats = async (name: string) => {
        setStats(prev => ({
            ...prev,
            [name]: {
                objectCount: prev[name]?.objectCount || 0,
                totalSize: prev[name]?.totalSize || 0,
                loading: true,
                loaded: false,
                error: false
            }
        }));
        try {
            const bucketStats = await getRawBucketStats(name);
            setStats(prev => ({
                ...prev,
                [name]: {
                    objectCount: bucketStats.objectCount,
                    totalSize: bucketStats.totalSize,
                    loading: false,
                    loaded: true,
                    error: false
                }
            }));
        } catch (error) {
            setStats(prev => ({
                ...prev,
                [name]: {
                    objectCount: prev[name]?.objectCount || 0,
                    totalSize: prev[name]?.totalSize || 0,
                    loading: false,
                    loaded: false,
                    error: true
                }
            }));
        }
    };

    const filteredBuckets = buckets.filter(b =>
        b.name.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
        {
            title: t('storage.bucket.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => (
                <Space>
                    <Database size={16} className="text-blue-500" />
                    <Text strong>{text}</Text>
                </Space>
            ),
        },
        {
            title: t('storage.bucket.created'),
            dataIndex: 'creationDate',
            key: 'creationDate',
            render: (date: string) => new Date(date).toLocaleString(),
        },
        {
            title: t('storage.bucket.objects'),
            key: 'objects',
            render: (_: any, record: Bucket) => {
                const stat = stats[record.name];
                const isLoaded = stat && stat.loaded;
                const isError = stat && stat.error;
                const isLoading = stat && stat.loading;

                if (!stat || (!isLoaded && !isLoading && !isError)) {
                    return (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => loadBucketStats(record.name)}
                            icon={<RefreshCw size={14} />}
                        >
                            {t('storage.stats.load')}
                        </Button>
                    );
                }
                if (isLoading) return <Spin size="small" />;
                if (isError) return <Tag color="red">{t('error')}</Tag>;
                return stat.objectCount.toLocaleString();
            }
        },
        {
            title: t('storage.bucket.size'),
            key: 'size',
            render: (_: any, record: Bucket) => {
                const stat = stats[record.name];
                if (stat?.loading) return <Spin size="small" />;
                if (stat?.error) return '-';
                if (!stat || (stat.totalSize === 0 && stat.objectCount === 0)) return '-';
                return formatFileSize(stat.totalSize);
            }
        },
        {
            title: t('storage.actions'),
            key: 'actions',
            render: (_: any, record: Bucket) => (
                <Space>
                    <Button
                        type="text"
                        danger
                        icon={<Trash2 size={16} />}
                        onClick={() => openDeleteModal(record.name)}
                    >
                        {t('common.delete')}
                    </Button>
                </Space>
            ),
        },
    ];

    const items = [
        {
            key: 'dashboard',
            label: (
                <span className="flex items-center space-x-2">
                    <LayoutDashboard size={16} />
                    <span>{t('storage.tabs.dashboard')}</span>
                </span>
            ),
            children: (
                <div className="flex flex-col h-[calc(100vh-180px)] mb-2">
                    <div className="flex justify-end mb-4 flex-none">
                        <Button
                            icon={<RefreshCw size={16} className={loadingMetrics ? 'animate-spin' : ''} />}
                            onClick={loadGlobalStats}
                            loading={loadingMetrics}
                            size="large"
                            className="bg-gray-800 text-white border-gray-700 hover:!bg-gray-700 hover:!text-white hover:!border-gray-600"
                        >
                            {t('storage.sync.button')}
                        </Button>
                    </div>

                    <Row gutter={16} className="mb-6 flex-none">
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title={t('storage.stats.totalBuckets')}
                                    value={buckets.length}
                                    prefix={<Server size={20} className="text-blue-500" />}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title={t('storage.stats.totalObjects')}
                                    value={globalMetrics.totalObjects}
                                    prefix={<FileText size={20} className="text-green-500" />}
                                    suffix={globalMetrics.totalObjects === 0 && !loadingMetrics ? <Tooltip title={t('storage.stats.syncTooltip')}><Tag color="warning" className="ml-2 pointer-events-none">{t('storage.stats.unsynced')}</Tag></Tooltip> : null}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title={t('storage.stats.totalSize')}
                                    value={formatFileSize(globalMetrics.totalSize)}
                                    prefix={<HardDrive size={20} className="text-purple-500" />}
                                />
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={16} className="flex-1 min-h-0 pb-2">
                        <Col span={12} className="h-full">
                            <Card className="h-full flex flex-col" styles={{ body: { padding: '0 12px', flex: 1, overflow: 'hidden' } }}>
                                <Tabs
                                    defaultActiveKey="buckets"
                                    className="h-full flex flex-col"
                                    items={[
                                        {
                                            key: 'buckets',
                                            label: t('storage.stats.totalBuckets').replace('Total ', ''),
                                            children: (
                                                <div className="h-full overflow-hidden">
                                                    <Table
                                                        dataSource={globalMetrics.topBuckets}
                                                        columns={[
                                                            { title: t('storage.bucket.name'), dataIndex: 'name', key: 'name' },
                                                            { title: t('storage.bucket.size'), dataIndex: 'size', key: 'size', render: (val) => formatFileSize(val) },
                                                            { title: t('storage.bucket.objects'), dataIndex: 'objectCount', key: 'objectCount' }
                                                        ]}
                                                        pagination={false}
                                                        size="small"
                                                        scroll={{ y: 'calc(100vh - 540px)' }}
                                                        rowKey="name"
                                                    />
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'files',
                                            label: t('documents.filesProgress'),
                                            children: (
                                                <div className="h-full overflow-hidden">
                                                    <Table
                                                        dataSource={globalMetrics.topFiles}
                                                        columns={[
                                                            { title: t('documents.name'), dataIndex: 'name', key: 'name', ellipsis: true },
                                                            { title: t('documents.bucketName'), dataIndex: 'bucketName', key: 'bucketName' },
                                                            { title: t('documents.size'), dataIndex: 'size', key: 'size', render: (val) => formatFileSize(val) },
                                                            { title: t('documents.modified'), dataIndex: 'lastModified', key: 'lastModified', render: (val) => new Date(val).toLocaleDateString() }
                                                        ]}
                                                        pagination={false}
                                                        size="small"
                                                        scroll={{ y: 'calc(100vh - 540px)' }}
                                                        rowKey={(record) => record.bucketName + record.name}
                                                    />
                                                </div>
                                            )
                                        }
                                    ]}
                                />
                            </Card>
                        </Col>
                        <Col span={12} className="h-full">
                            <Card title={t('storage.charts.distribution')} className="h-full overflow-auto">
                                <div className="space-y-4 pt-2">
                                    {Object.entries(globalMetrics.distribution || {}).length === 0 && !loadingMetrics ? (
                                        <div className="text-center text-gray-400 py-10">{t('storage.charts.syncPrompt')}</div>
                                    ) : (
                                        Object.entries(globalMetrics.distribution || {
                                            '<1MB': 0, '1MB-10MB': 0, '10MB-100MB': 0, '100MB-1GB': 0, '1GB-5GB': 0, '5GB-10GB': 0, '>10GB': 0
                                        }).map(([range, count]) => {
                                            const total = globalMetrics.totalObjects || 1;
                                            const percentage = Math.min(100, Math.max(1, (count / total) * 100));
                                            return (
                                                <div key={range} className="flex items-center text-sm">
                                                    <div className="w-24 text-gray-500 dark:text-gray-400">{range}</div>
                                                    <div className="flex-1 mx-4 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-900 rounded-full"
                                                            style={{ width: `${count === 0 ? 0 : percentage}%`, transition: 'width 0.5s ease-in-out' }}
                                                        />
                                                    </div>
                                                    <div className="w-12 text-right text-gray-600 dark:text-gray-300 font-mono">{count}</div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </div>
            )
        },
        // {
        //     key: 'keys',
        //     label: (
        //         <span className="flex items-center space-x-2">
        //             <Key size={16} />
        //             <span>{t('storage.tabs.keys')}</span>
        //         </span>
        //     ),
        //     children: (
        //         <div className="space-y-6">
        //             <Card className="shadow-sm" bodyStyle={{ paddingBottom: '24px' }}>
        //                 <div className="mb-4 flex justify-between items-center">
        //                     <div />
        //                     <Button
        //                         type="primary"
        //                         icon={<Plus size={18} />}
        //                         onClick={() => setCreateKeyModalVisible(true)}
        //                         size="large"
        //                     >
        //                         {t('storage.keys.create.label')}
        //                     </Button>
        //                 </div>
        //                 <Table
        //                     columns={keyColumns}
        //                     dataSource={accessKeys}
        //                     rowKey="accessKey"
        //                     loading={keysLoading}
        //                     pagination={{ pageSize: 10 }}
        //                 />
        //             </Card>

        //             {/* Create Key Modal */}
        //             <Modal
        //                 title={t('storage.keys.create.title')}
        //                 open={createKeyModalVisible}
        //                 onOk={handleCreateKey}
        //                 onCancel={() => setCreateKeyModalVisible(false)}
        //                 confirmLoading={creatingKey}
        //             >
        //                 <div className="py-4 space-y-4">
        //                     <div>
        //                         <Text strong>{t('storage.keys.create.name')}</Text>
        //                         <Input
        //                             className="mt-1"
        //                             value={keyName}
        //                             onChange={e => setKeyName(e.target.value)}
        //                             placeholder="Service Account Name"
        //                         />
        //                     </div>
        //                     <div>
        //                         <Text strong>{t('storage.keys.create.description')}</Text>
        //                         <Input
        //                             className="mt-1"
        //                             value={keyDesc}
        //                             onChange={e => setKeyDesc(e.target.value)}
        //                             placeholder="Description"
        //                         />
        //                     </div>
        //                 </div>
        //             </Modal>

        //             {/* Credentials Modal */}
        //             <Modal
        //                 title={t('storage.keys.credentials.title')}
        //                 open={credsModalVisible}
        //                 onOk={() => setCredsModalVisible(false)}
        //                 onCancel={() => setCredsModalVisible(false)}
        //                 footer={[
        //                     <Button key="ok" type="primary" onClick={() => setCredsModalVisible(false)}>
        //                         Done
        //                     </Button>
        //                 ]}
        //             >
        //                 <div className="py-4 space-y-4">
        //                     <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
        //                         <Text type="warning">{t('storage.keys.credentials.warning')}</Text>
        //                     </div>
        //                     <div>
        //                         <Text strong>{t('storage.keys.credentials.accessKey')}</Text>
        //                         <div className="flex gap-2 mt-1">
        //                             <Input value={generatedCredentials?.accessKey} readOnly />
        //                             <Button icon={<FileText size={16} />} onClick={() => {
        //                                 navigator.clipboard.writeText(generatedCredentials?.accessKey || '');
        //                                 message.success(t('storage.keys.credentials.copy'));
        //                             }} />
        //                         </div>
        //                     </div>
        //                     <div>
        //                         <Text strong>{t('storage.keys.credentials.secretKey')}</Text>
        //                         <div className="flex gap-2 mt-1">
        //                             <Input.Password value={generatedCredentials?.secretKey} readOnly visibilityToggle />
        //                             <Button icon={<FileText size={16} />} onClick={() => {
        //                                 navigator.clipboard.writeText(generatedCredentials?.secretKey || '');
        //                                 message.success(t('storage.keys.credentials.copy'));
        //                             }} />
        //                         </div>
        //                     </div>
        //                 </div>
        //             </Modal>
        //         </div>
        //     )
        // },
        {
            key: 'buckets',
            label: (
                <span className="flex items-center space-x-2">
                    <HardDrive size={16} />
                    <span>{t('storage.tabs.buckets')}</span>
                </span>
            ),
            children: (
                <div className="space-y-6">
                    <Card className="shadow-sm" styles={{ body: { paddingBottom: '24px' } }}>
                        <div className="mb-4 flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                <Input
                                    prefix={<Search size={16} className="text-gray-400" />}
                                    placeholder={t('storage.search.placeholder')}
                                    value={searchText}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
                                    style={{ width: 300 }}
                                />
                                <Button
                                    icon={<RefreshCw size={16} />}
                                    onClick={loadBuckets}
                                />
                            </div>
                            <Button
                                type="primary"
                                icon={<Plus size={18} />}
                                onClick={() => setCreateModalVisible(true)}
                                size="large"
                            >
                                {t('storage.createButton')}
                            </Button>
                        </div>

                        <Table
                            columns={columns}
                            dataSource={filteredBuckets}
                            rowKey="name"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                            scroll={{ y: 'calc(100vh - 450px)' }}
                            style={{ marginBottom: 20 }}
                        />
                    </Card>
                    <Modal
                        title={t('storage.create.title')}
                        open={createModalVisible}
                        onOk={handleCreate}
                        onCancel={() => setCreateModalVisible(false)}
                        confirmLoading={creating}
                    >
                        <div className="py-4">
                            <div className="mb-2">
                                <Text strong>{t('storage.create.label')}</Text>
                                <span className="text-red-500">*</span>
                            </div>
                            <Input
                                placeholder={t('storage.create.placeholder')}
                                value={newBucketName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBucketName(e.target.value)}
                            />
                            <div className="mt-2">
                                <Text type="secondary" className="text-xs">
                                    {t('storage.create.rules')}
                                </Text>
                            </div>
                        </div>
                    </Modal>

                    <Modal
                        title={t('storage.delete.confirm')}
                        open={deleteModalVisible}
                        onOk={handleDelete}
                        onCancel={() => setDeleteModalVisible(false)}
                        confirmLoading={deleting}
                        okText={t('common.delete')}
                        okButtonProps={{
                            danger: true,
                            disabled: deleteConfirmationName !== bucketToDelete
                        }}
                    >
                        <div className="py-4">
                            <div className="mb-4">
                                <Text type="danger">{t('storage.delete.warning')}</Text>
                            </div>
                            <div className="mb-2">
                                <Text>{t('storage.delete.confirmType', { name: bucketToDelete })}</Text>
                            </div>
                            <Input
                                placeholder={bucketToDelete || ''}
                                value={deleteConfirmationName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirmationName(e.target.value)}
                            />
                        </div>
                    </Modal>
                </div>
            )
        }
    ];

    return (
        <div className="p-6">
            <div className="mb-2">
                <Title level={4} className="!mb-0">{t('storage.subtitle')}</Title>
            </div>

            <Tabs defaultActiveKey="dashboard" items={items} />
        </div>
    );
};

export default StoragePage;
