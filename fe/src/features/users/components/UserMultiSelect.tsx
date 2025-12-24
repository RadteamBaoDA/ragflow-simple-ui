import { useState, useMemo } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { User } from '@/features/auth';
import { useTranslation } from 'react-i18next';

interface UserMultiSelectProps {
    users: User[];
    selectedUserIds: string[];
    onChange: (userIds: string[]) => void;
    placeholder?: string;
}

export default function UserMultiSelect({ users, selectedUserIds, onChange, placeholder }: UserMultiSelectProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');

    const filteredUsers = useMemo(() => {
        return query === ''
            ? users
            : users.filter((user) =>
                user.displayName.toLowerCase().includes(query.toLowerCase()) ||
                user.email.toLowerCase().includes(query.toLowerCase()) ||
                user.id.toLowerCase().includes(query.toLowerCase())
            )
    }, [users, query]);

    const selectedUsers = useMemo(() => {
        return users.filter(u => selectedUserIds.includes(u.id));
    }, [users, selectedUserIds]);

    const handleChange = (userIds: string[]) => {
        onChange(userIds);
        setQuery(''); // Clear query after selection
    };

    const removeUser = (userId: string) => {
        onChange(selectedUserIds.filter(id => id !== userId));
    };

    return (
        <div className="w-full">
            <Combobox value={selectedUserIds} onChange={handleChange} multiple>
                <div className="relative mt-1">
                    <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white dark:bg-slate-800 text-left border border-slate-300 dark:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-300 sm:text-sm">
                        <div className="flex flex-wrap gap-1 p-1 min-h-[42px] items-center pr-10">
                            {selectedUsers.map(user => (
                                <span key={user.id} className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                                    {user.displayName}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeUser(user.id);
                                        }}
                                        className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                            <Combobox.Input
                                className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-slate-900 dark:text-white bg-transparent focus:ring-0 outline-none placeholder-slate-400"
                                onChange={(event) => setQuery(event.target.value)}
                                displayValue={() => ''} // Input should always be empty after selection logic handles display
                                placeholder={selectedUsers.length === 0 ? (placeholder || t('iam.teams.selectUser')) : ''}
                            />
                        </div>
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronsUpDown
                                className="h-5 w-5 text-slate-400"
                                aria-hidden="true"
                            />
                        </Combobox.Button>
                    </div>
                    <Transition
                        as="div"
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        afterLeave={() => setQuery('')}
                    >
                        <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-700 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-50">
                            {filteredUsers.length === 0 && query !== '' ? (
                                <div className="relative cursor-default select-none px-4 py-2 text-slate-700 dark:text-slate-300">
                                    {t('common.noData')}
                                </div>
                            ) : (
                                filteredUsers.map((user) => (
                                    <Combobox.Option
                                        key={user.id}
                                        className={({ active }) =>
                                            `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-slate-900 dark:text-white'
                                            }`
                                        }
                                        value={user.id}
                                    >
                                        {({ selected, active }) => (
                                            <>
                                                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                    {user.displayName} <span className={`text-xs ${active ? 'text-blue-100' : 'text-slate-400'}`}>({user.email})</span>
                                                </span>
                                                {selectedUserIds.includes(user.id) ? (
                                                    <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-blue-600'}`}>
                                                        <Check className="h-5 w-5" aria-hidden="true" />
                                                    </span>
                                                ) : null}
                                            </>
                                        )}
                                    </Combobox.Option>
                                ))
                            )}
                        </Combobox.Options>
                    </Transition>
                </div>
            </Combobox>
        </div>
    );
}
