import { useTranslation } from 'react-i18next';
import { Check, X, Shield, Users, User, AlertCircle } from 'lucide-react';

interface PermissionMatrixItem {
    permission: string;
    description: string;
    admin: boolean;
    leader: boolean;
    user: boolean;
}

export default function PermissionManagementPage() {
    const { t } = useTranslation();

    const permissions: PermissionMatrixItem[] = [
        {
            permission: 'AI Chat Access',
            description: t('iam.permissions.chatDesc', 'Access to AI Chat interface'),
            admin: true,
            leader: true,
            user: true
        },
        {
            permission: 'AI Search Access',
            description: t('iam.permissions.searchDesc', 'Access to AI Search interface'),
            admin: true,
            leader: true,
            user: true
        },
        {
            permission: 'Select Sources',
            description: t('iam.permissions.sourceDesc', 'Ability to choose different Chat/Search sources'),
            admin: true,
            leader: true,
            user: false
        },
        {
            permission: 'Storage: Read',
            description: t('iam.permissions.storageReadDesc', 'View and download files'),
            admin: true,
            leader: true,
            user: false
        },
        {
            permission: 'Storage: Write',
            description: t('iam.permissions.storageWriteDesc', 'Upload, delete, and manage files/folders'),
            admin: true,
            leader: true,
            user: false
        },
        {
            permission: 'User Management',
            description: t('iam.permissions.userManageDesc', 'Add/Remove users, manage teams'),
            admin: true,
            leader: true,
            user: false
        },
        {
            permission: 'System Config',
            description: t('iam.permissions.sysConfigDesc', 'Configure system settings and API connections'),
            admin: true,
            leader: false,
            user: false
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-primary dark:text-blue-400" />
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('iam.permissions.title', 'Permission Management')}</h1>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-slate-600 dark:text-slate-400">
                        {t('iam.permissions.description', 'View and understand the permission levels for different roles in the system. Roles are assigned at the team level.')}
                    </p>

                    <div className="mt-4 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium">{t('iam.permissions.noteTitle', 'Role Assignment Note')}</p>
                            <p className="mt-1">{t('iam.permissions.noteBody', 'Permissions are predefined and cannot be customized per user. To change a user\'s access level, assign them a different role (Member or Leader) within their team.')}</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 w-1/3">
                                    {t('iam.permissions.feature', 'Feature / Permission')}
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 w-1/6">
                                    <div className="flex flex-col items-center gap-1">
                                        <User className="w-5 h-5 text-slate-500" />
                                        <span>{t('iam.roles.user', 'Member')}</span>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 w-1/6">
                                    <div className="flex flex-col items-center gap-1">
                                        <Users className="w-5 h-5 text-blue-500" />
                                        <span>{t('iam.roles.leader', 'Leader')}</span>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 w-1/6">
                                    <div className="flex flex-col items-center gap-1">
                                        <Shield className="w-5 h-5 text-purple-500" />
                                        <span>{t('iam.roles.admin', 'Admin')}</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {permissions.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-800 dark:text-slate-200">{item.permission}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.user ? (
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                    <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.leader ? (
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                    <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.admin ? (
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                    <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
