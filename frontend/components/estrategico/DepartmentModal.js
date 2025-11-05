import React, { useState, useEffect } from 'react';
import { X, Check, ChevronsUpDown } from 'lucide-react';
import { Combobox } from '@headlessui/react';
import styles from '../../styles/estrategico/DepartmentModal.module.css';

// Configuração da API
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;

// Helper para obter token do localStorage
const getToken = () => {
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
};

// Helper para obter EmpresaId do localStorage
const getEmpresaId = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.EmpresaId || parsed.empresaId || null;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper para fazer requisições fetch
const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const empresaId = getEmpresaId();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (empresaId) {
    headers['X-Empresa-Id'] = empresaId.toString();
  }

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(normalizeUrl(url), config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export function DepartmentModal({
  isOpen,
  onClose,
  onSubmit,
  department,
  title,
  parentDepartments = [],
  allEmployees,
  companyId,
  isEditDisabled
}) {
  const [departmentName, setDepartmentName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [parentQuery, setParentQuery] = useState('');
  const [managerQuery, setManagerQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (department) {
      setDepartmentName(department.title);
      setDescription(department.description ?? '');
      setParentId(department.parent_id || undefined);
      // Tentar usar manager.id primeiro, depois manager_id, depois null
      setSelectedManagerId(department.manager?.id ?? department.manager_id ?? null);
    } else {
      setDepartmentName('');
      setDescription('');
      setParentId(undefined);
      setSelectedManagerId(null);
    }
  }, [department]);

  useEffect(() => {
    // Carregar dados completos se description ou manager estiverem faltando
    const needsDescription = department && (department.description === undefined || department.description === null);
    const needsManager = department && (!department.manager || !department.manager.id) && department.manager_id;
    
    if (department && (needsDescription || needsManager) && companyId) {
      apiFetch(`/estrategico/departamentos/${department.id}?companyId=${companyId}`).then(dep => {
        if (needsDescription) {
          setDescription(dep?.description ?? '');
        }
        // Atualizar selectedManagerId se os dados do manager vierem da API
        if (dep?.manager?.id) {
          setSelectedManagerId(dep.manager.id);
        } else if (dep?.manager_id) {
          setSelectedManagerId(dep.manager_id);
        }
      }).catch(error => {
        console.error('Erro ao carregar dados do departamento:', error);
      });
    }
  }, [department, companyId]);

  if (!isOpen) return null;

  const filteredParentDepartments = parentQuery === ''
    ? parentDepartments
    : parentDepartments.filter((dept) =>
        dept.title.toLowerCase().includes(parentQuery.toLowerCase())
      );

  // A API já retorna funcionários filtrados pela empresa e sem SUPERADMIN
  // Então podemos usar todos os funcionários retornados
  const eligibleEmployees = Array.isArray(allEmployees) ? allEmployees : [];

  const filteredEmployees = managerQuery === ''
    ? eligibleEmployees
    : eligibleEmployees.filter((employee) =>
        employee.full_name.toLowerCase().includes(managerQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(managerQuery.toLowerCase())
      );

  const selectedEmployee = selectedManagerId ? allEmployees.find(emp => {
    // Comparar como número ou string para evitar problemas de tipo
    const empId = Number(emp.id);
    const managerId = Number(selectedManagerId);
    return empId === managerId;
  }) || null : null;
  
  console.log('🔍 [DepartmentModal] selectedManagerId:', selectedManagerId, typeof selectedManagerId);
  console.log('🔍 [DepartmentModal] allEmployees:', allEmployees?.length, 'funcionários');
  console.log('🔍 [DepartmentModal] allEmployees IDs:', allEmployees?.map(e => ({ id: e.id, nome: e.full_name || e.nome })));
  console.log('🔍 [DepartmentModal] eligibleEmployees:', eligibleEmployees?.length, 'funcionários elegíveis');
  console.log('🔍 [DepartmentModal] filteredEmployees:', filteredEmployees?.length, 'funcionários filtrados');
  console.log('🔍 [DepartmentModal] selectedEmployee:', selectedEmployee);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('🔍 [DepartmentModal] handleSubmit - selectedManagerId:', selectedManagerId);

    const isTryingToMakeRoot = !parentId;
    const alreadyHasRoot = parentDepartments.some(dep => !dep.parent_id);
    const isCurrentlyRoot = department && !department.parent_id;
    const isFirstDepartment = parentDepartments.length === 0;
    
    if (isTryingToMakeRoot && alreadyHasRoot && !isCurrentlyRoot) {
      setError('Já existe um departamento raiz. Só é permitido um departamento sem superior.');
      setLoading(false);
      return;
    }

    if (isFirstDepartment && !parentId) {
      console.log('🏢 [DepartmentModal] Primeiro departamento da empresa - será definido como raiz automaticamente');
    }

    try {
      const finalParentId = parentId || null;
      
      const submitData = {
        title: departmentName,
        description,
        parent_id: finalParentId,
        manager_id: selectedManagerId || null
      };
      console.log('🔍 [DepartmentModal] Enviando dados:', submitData);
      console.log('🔍 [DepartmentModal] selectedManagerId:', selectedManagerId);
      console.log('🔍 [DepartmentModal] manager_id final:', selectedManagerId || null);
      
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar departamento:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button
            onClick={onClose}
            className={styles.modalCloseButton}
          >
            <X size={24} />
          </button>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.formLabel}>
              Nome do Departamento
            </label>
            <input
              type="text"
              id="name"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className={styles.formInput}
              required
              disabled={isEditDisabled}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description" className={styles.formLabel}>
              Descrição
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={styles.formTextarea}
              disabled={isEditDisabled}
            />
          </div>

          {parentDepartments.length > 0 && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Departamento Superior
              </label>
              
              {department && !department.parent_id ? (
                <div className={styles.disabledInputWrapper}>
                  <input
                    type="text"
                    value="Departamento raiz não pode ser movido"
                    className={styles.disabledInput}
                    disabled
                    readOnly
                  />
                  <p className={styles.warningText}>
                    Este departamento é o raiz da organização e não pode ser movido para ser filho de outro departamento.
                  </p>
                </div>
              ) : (
                <Combobox 
                  value={parentDepartments.find(dept => dept.id === parentId)} 
                  onChange={(dept) => {
                    const newParentId = dept?.id;
                    setParentId(newParentId);
                    setError('');
                    const isTryingToMakeRoot = !newParentId;
                    const alreadyHasRoot = parentDepartments.some(dep => !dep.parent_id);
                    const isCurrentlyRoot = department && !department.parent_id;
                    
                    if (isTryingToMakeRoot && alreadyHasRoot && !isCurrentlyRoot) {
                      setError('Já existe um departamento raiz. Só é permitido um departamento sem superior.');
                    }
                  }} 
                  disabled={isEditDisabled}
                >
                  <div className={styles.comboboxContainer}>
                    <div className={styles.comboboxInput}>
                      <Combobox.Input
                        className={styles.comboboxInput}
                        displayValue={(dept) => dept?.title || 'Nenhum (Departamento Raiz)'}
                        onChange={(event) => setParentQuery(event.target.value)}
                        placeholder="Buscar departamento..."
                      />
                      <Combobox.Button className={styles.comboboxButton}>
                        <ChevronsUpDown
                          size={20}
                          className="text-gray-400"
                          aria-hidden="true"
                        />
                      </Combobox.Button>
                    </div>
                    <Combobox.Options className={styles.comboboxOptions}>
                      <Combobox.Option
                        className={({ active }) => {
                          const alreadyHasRoot = parentDepartments.some(dep => !dep.parent_id);
                          const isCurrentlyRoot = department && !department.parent_id;
                          const isDisabled = alreadyHasRoot && !isCurrentlyRoot;
                          
                          return `${styles.comboboxOption} ${
                            isDisabled 
                              ? styles.comboboxOptionDisabled
                              : active 
                                ? styles.comboboxOptionActive 
                                : styles.comboboxOptionInactive
                          }`;
                        }}
                        value={null}
                        disabled={parentDepartments.some(dep => !dep.parent_id) && !(department && !department.parent_id)}
                      >
                        {({ selected, active }) => {
                          const alreadyHasRoot = parentDepartments.some(dep => !dep.parent_id);
                          const isCurrentlyRoot = department && !department.parent_id;
                          const isDisabled = alreadyHasRoot && !isCurrentlyRoot;
                          
                          return (
                            <>
                              <span className={`${styles.comboboxOptionText} ${selected ? styles.comboboxOptionTextSelected : styles.comboboxOptionTextUnselected}`}>
                                {isDisabled 
                                  ? 'Nenhum (Departamento Raiz) - Já existe um raiz' 
                                  : 'Nenhum (Departamento Raiz)'
                                }
                              </span>
                              {selected && (
                                <span className={`${styles.comboboxOptionCheckIcon} ${active ? styles.comboboxOptionCheckIconActive : styles.comboboxOptionCheckIconInactive}`}>
                                  <Check size={20} aria-hidden="true" />
                                </span>
                              )}
                            </>
                          );
                        }}
                      </Combobox.Option>
                      {filteredParentDepartments.map((dept) => (
                        <Combobox.Option
                          key={dept.id}
                          className={({ active }) =>
                            `${styles.comboboxOption} ${active ? styles.comboboxOptionActive : styles.comboboxOptionInactive}`
                          }
                          value={dept}
                        >
                          {({ selected, active }) => (
                            <>
                              <span className={`${styles.comboboxOptionText} ${selected ? styles.comboboxOptionTextSelected : styles.comboboxOptionTextUnselected}`}>
                                {dept.title}
                              </span>
                              {selected && (
                                <span className={`${styles.comboboxOptionCheckIcon} ${active ? styles.comboboxOptionCheckIconActive : styles.comboboxOptionCheckIconInactive}`}>
                                  <Check size={20} aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Combobox.Option>
                      ))}
                    </Combobox.Options>
                  </div>
                </Combobox>
              )}
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Gestor</label>
            {Array.isArray(allEmployees) && (
              <Combobox
                value={selectedEmployee ?? null}
                onChange={employee => {
                  if (employee === null) {
                    setSelectedManagerId(null);
                  } else {
                    setSelectedManagerId(employee.id);
                  }
                }}
                disabled={isEditDisabled}
              >
                <div className={styles.comboboxContainer}>
                  <div className={styles.comboboxInput}>
                    <Combobox.Input
                      className={styles.comboboxInput}
                      displayValue={(employee) => employee?.full_name || 'Sem Líder'}
                      onChange={(event) => setManagerQuery(event.target.value)}
                      placeholder="Buscar gestor..."
                    />
                    <Combobox.Button className={styles.comboboxButton}>
                      <ChevronsUpDown
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </Combobox.Button>
                  </div>
                  <Combobox.Options className={styles.comboboxOptions}>
                    <Combobox.Option
                      className={({ active }) =>
                        `${styles.comboboxOption} ${active ? styles.comboboxOptionActive : styles.comboboxOptionInactive}`
                      }
                      value={null}
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={`${styles.comboboxOptionText} ${selected ? styles.comboboxOptionTextSelected : styles.comboboxOptionTextUnselected}`}>
                            Sem Líder
                          </span>
                          {selected && (
                            <span className={`${styles.comboboxOptionCheckIcon} ${active ? styles.comboboxOptionCheckIconActive : styles.comboboxOptionCheckIconInactive}`}>
                              <Check size={20} aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Combobox.Option>
                    
                    {filteredEmployees.length === 0 && managerQuery !== '' ? (
                      <div className={styles.comboboxEmptyMessage}>
                        Nenhum resultado encontrado.
                      </div>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <Combobox.Option
                          key={employee.id}
                          className={({ active }) =>
                            `${styles.comboboxOption} ${active ? styles.comboboxOptionActive : styles.comboboxOptionInactive}`
                          }
                          value={employee}
                        >
                          {({ selected, active }) => (
                            <>
                              <span className={`${styles.comboboxOptionText} ${selected ? styles.comboboxOptionTextSelected : styles.comboboxOptionTextUnselected}`}>
                                {employee.full_name} - {employee.email}
                              </span>
                              {selected && (
                                <span className={`${styles.comboboxOptionCheckIcon} ${active ? styles.comboboxOptionCheckIconActive : styles.comboboxOptionCheckIconInactive}`}>
                                  <Check size={20} aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </div>
              </Combobox>
            )}
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.button} ${styles.buttonSecondary}`}
              disabled={loading || isEditDisabled}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={loading || isEditDisabled}
            >
              {loading ? 'Salvando...' : (department ? 'Atualizar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

