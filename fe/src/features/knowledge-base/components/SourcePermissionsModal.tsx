import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Button, Select, Table } from 'antd';
import { Globe, Lock, Users, User, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { AccessControl, KnowledgeBaseSource } from '../api/knowledgeBaseService';
import { teamApi, type Team } from '@/features/teams';
import { userApi } from '@/features/users';
import { User as UserType } from '@/features/auth';

export interface PermissionsSelectorProps {
  /** Whether the source is public */
  isPublic: boolean;
  /** Callback to update public state */
  setIsPublic: (value: boolean) => void;
  /** Team IDs with access */
  selectedTeamIds?: string[];
  /** Callback to update team IDs */
  setSelectedTeamIds?: (value: string[]) => void;
  /** User IDs with access */
  selectedUserIds?: string[];
  /** Callback to update user IDs */
  setSelectedUserIds?: (value: string[]) => void;
  /** List of available teams */
  teams?: Team[];
  /** List of available users */
  users?: UserType[];
  /** Loading state for data */
  isLoading?: boolean;
  /** Disable editing */
  disabled?: boolean;
}

/**
 * PermissionsSelector - Inline component for selecting permissions in forms.
 * 
 * @param {PermissionsSelectorProps} props - Component props including selection state and data.
 * @returns {React.ReactElement} React component for selecting public/private access and specific ACLs.
 */
export const PermissionsSelector: React.FC<PermissionsSelectorProps> = ({
  isPublic,
  setIsPublic,
  selectedTeamIds = [],
  setSelectedTeamIds,
  selectedUserIds = [],
  setSelectedUserIds,
  teams = [],
  users = [],
  isLoading = false,
  disabled = false
}) => {
  const { t } = useTranslation();

  // Filter selected entities to display in tables
  const selectedTeams = teams.filter(team => selectedTeamIds.includes(team.id));
  const selectedUsers = users.filter(user => selectedUserIds.includes(user.id));

  return (
    <div className="space-y-4 h-full flex flex-col min-h-0">
      {/* Section Header */}
      <div className="flex items-center gap-2 shrink-0">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('common.permissions') || 'Permissions'}
        </h4>
      </div>

      {/* Public/Private Toggle - Switches between global access and restricted access */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 shrink-0">
        <div className="flex items-center gap-3">
          {isPublic ? (
            <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {isPublic
                ? (t('knowledgeBaseConfig.publicAccess') || 'Public Access')
                : (t('knowledgeBaseConfig.privateAccess') || 'Private Access')
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isPublic
                ? (t('knowledgeBaseConfig.publicAccessDesc') || 'All authenticated users can access this source')
                : (t('knowledgeBaseConfig.privateAccessDesc') || 'Only selected teams or users can access this source')
              }
            </p>
          </div>
        </div>
        <Switch
          checked={isPublic}
          onChange={setIsPublic}
          disabled={disabled}
          className={isPublic ? 'bg-green-500' : 'bg-gray-300'}
        />
      </div>

      {/* Private Access Detail Selectors - Only shown when public access is disabled */}
      {!isPublic && (
        <div className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Team Selection Section */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Users size={14} />
                {t('knowledgeBaseConfig.selectTeams') || 'Select Teams'}
              </label>
              <Select
                mode="multiple"
                showSearch
                className="w-full"
                placeholder={t('knowledgeBaseConfig.selectTeamsPlaceholder') || 'Select teams allowed to access this source'}
                value={selectedTeamIds}
                onChange={setSelectedTeamIds}
                disabled={disabled || isLoading}
                loading={isLoading}
                optionFilterProp="label"
                dropdownMatchSelectWidth={false}
                listHeight={400}
                options={teams.map(team => ({
                  label: team.name,
                  value: team.id
                }))}
              />
            </div>

            {/* Selected Teams Table */}
            {selectedTeams.length > 0 && (
              <div className="w-full overflow-x-auto">
                <Table
                  dataSource={selectedTeams}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  className="border border-gray-100 dark:border-slate-700 rounded-md overflow-hidden"
                  columns={[
                    {
                      title: t('common.name') || 'Name',
                      dataIndex: 'name',
                      key: 'name',
                      className: 'text-xs'
                    },
                    {
                      title: '',
                      key: 'action',
                      width: 50,
                      align: 'center',
                      render: (_: any, record: Team) => (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<Trash2 size={14} />}
                          onClick={() => setSelectedTeamIds?.(selectedTeamIds.filter(id => id !== record.id))}
                        />
                      )
                    }
                  ]}
                />
              </div>
            )}
          </div>

          {/* User Selection Section */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <User size={14} />
                {t('knowledgeBaseConfig.selectUsers') || 'Select Users'}
              </label>
              <Select
                mode="multiple"
                showSearch
                className="w-full"
                placeholder={t('knowledgeBaseConfig.selectUsersPlaceholder') || 'Select users allowed to access this source'}
                value={selectedUserIds}
                onChange={setSelectedUserIds}
                disabled={disabled || isLoading}
                loading={isLoading}
                optionFilterProp="label"
                dropdownMatchSelectWidth={false}
                listHeight={400}
                options={users.map(user => ({
                  label: `${user.displayName} (${user.email})`,
                  value: user.id
                }))}
              />
            </div>

            {/* Selected Users Table */}
            {selectedUsers.length > 0 && (
              <div className="w-full overflow-x-auto">
                <Table
                  dataSource={selectedUsers}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  className="border border-gray-100 dark:border-slate-700 rounded-md overflow-hidden"
                  columns={[
                    {
                      title: t('common.name') || 'Name',
                      dataIndex: 'displayName',
                      key: 'name',
                      className: 'text-xs'
                    },
                    {
                      title: t('common.email') || 'Email',
                      dataIndex: 'email',
                      key: 'email',
                      className: 'text-xs text-gray-500 dark:text-gray-400'
                    },
                    {
                      title: '',
                      key: 'action',
                      width: 50,
                      align: 'center',
                      render: (_: any, record: UserType) => (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<Trash2 size={14} />}
                          onClick={() => setSelectedUserIds?.(selectedUserIds.filter(id => id !== record.id))}
                        />
                      )
                    }
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Note about System Defaults */}
      <p className="text-xs text-orange-500 dark:text-orange-400 shrink-0">
        {t('knowledgeBaseConfig.publicOnlyNote') || 'Only public sources can be set as system defaults.'}
      </p>
    </div>
  );
};

export interface SourcePermissionsModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Source to edit permissions for */
  source: KnowledgeBaseSource | null;
  /** Callback to save permissions */
  onSave: (id: string, permissions: AccessControl) => void;
}

/**
 * SourcePermissionsModal - Standalone modal for editing source permissions.
 * 
 * @param {SourcePermissionsModalProps} props - Component props including open state and callbacks.
 * @returns {React.ReactElement | null} Modal dialog for editing source permissions or null if not open.
 */
export const SourcePermissionsModal: React.FC<SourcePermissionsModalProps> = ({
  open,
  onClose,
  source,
  onSave
}) => {
  const { t } = useTranslation();

  // Local state for permissions
  const [isPublic, setIsPublic] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // State for teams and users lists
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Sync state when source changes
  useEffect(() => {
    if (source?.access_control) {
      setIsPublic(source.access_control.public);
      setSelectedTeamIds(source.access_control.team_ids || []);
      setSelectedUserIds(source.access_control.user_ids || []);
    } else {
      // Default to public if no access control
      setIsPublic(true);
      setSelectedTeamIds([]);
      setSelectedUserIds([]);
    }
  }, [source]);

  // Fetch teams and users when modal opens or becomes private
  useEffect(() => {
    if (open && !isPublic && teams.length === 0 && users.length === 0) {
      const fetchData = async () => {
        setIsLoadingData(true);
        try {
          const [teamsList, usersList] = await Promise.all([
            teamApi.getTeams(),
            userApi.getUsers()
          ]);
          setTeams(teamsList);
          setUsers(usersList);
        } catch (error) {
          console.error('[SourcePermissionsModal] Failed to fetch teams/users:', error);
        } finally {
          // Reset loading state regardless of outcome
          setIsLoadingData(false);
        }
      };
      fetchData();
    }
  }, [open, isPublic, teams.length, users.length]);

  /**
   * Handle save button click.
   * Constructs the access control object and calls onSave with ID and ACL.
   */
  const handleSave = () => {
    // Ensure we have a valid source to update
    if (!source?.id) return;

    // Construct ACL payload based on current state
    const accessControl: AccessControl = {
      public: isPublic,
      team_ids: isPublic ? [] : selectedTeamIds,
      user_ids: isPublic ? [] : selectedUserIds,
    };

    // Callback to parent component
    onSave(source.id, accessControl);
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('knowledgeBaseConfig.editPermissions') || 'Edit Permissions'}
      maxWidth="none"
      className="w-[40vw]"
    >
      <div className="space-y-6">
        {/* Source Info */}
        {source && (
          <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-gray-100">{source.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{source.url}</p>
          </div>
        )}

        {/* Permissions Selector */}
        <PermissionsSelector
          isPublic={isPublic}
          setIsPublic={setIsPublic}
          selectedTeamIds={selectedTeamIds}
          setSelectedTeamIds={setSelectedTeamIds}
          selectedUserIds={selectedUserIds}
          setSelectedUserIds={setSelectedUserIds}
          teams={teams}
          users={users}
          isLoading={isLoadingData}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <Button onClick={onClose}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button type="primary" onClick={handleSave}>
            {t('common.save') || 'Save'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
