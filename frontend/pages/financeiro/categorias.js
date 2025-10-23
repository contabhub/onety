"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/financeiro/card';
import styles from '../../styles/financeiro/categorias.module.css';
import { Button } from '../../components/financeiro/botao';
import { Input } from '../../components/financeiro/input';
import { Label } from '../../components/financeiro/label';
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  Search
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/financeiro/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/financeiro/select';
import { toast } from 'react-toastify';

// Componente de Loading
const LoadingState = ({ message = "Carregando categorias..." }) => (
  <div className={styles.categoriasLoading}>
    <div className={styles.categoriasLoadingSpinner}></div>
    <p className={styles.categoriasLoadingText}>{message}</p>
  </div>
);


const CategoryModal = ({ isOpen, onClose, onSave, category, type, isSubcategory = false, isSaving }) => {
  const [formData, setFormData] = useState({
    nome: '',
    dre: type === 'receita' ? 'Receitas' : 'Custo dos Serviços Prestados',
    showInDre: true
  });

  useEffect(() => {
    if (category) {
      setFormData({
        nome: category.nome || '',
        dre: category.dre || (type === 'receita' ? 'Receitas' : 'Custo dos Serviços Prestados'),
        showInDre: category.showInDre ?? true
      });
    }
  }, [category, type]);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };



  const dreOptions = type === 'receita'
    ? ['Receitas', 'Outras Receitas Não Operacionais']
    : ['Custo dos Serviços Prestados', 'Despesas Administrativas', 'Não mostrar no DRE Gerencial'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.categoriasModal}>
        <DialogHeader className={styles.categoriasModalHeader}>
          <DialogTitle className={styles.categoriasModalTitle}>
            {category ? 'Editar' : 'Nova'} categoria de {type}
          </DialogTitle>
        </DialogHeader>

        <div className={styles.categoriasModalBody}>
          <div className={styles.categoriasModalSpace}>
            <div className={styles.categoriasModalField}>
              <Label htmlFor="description" className={styles.categoriasModalLabel}>Descrição *</Label>
              <Input
                id="description"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Digite a descrição da categoria"
                className={styles.categoriasModalInput}
              />
            </div>
          </div>

          {/* <div className="space-y-2">
            <div className={styles.categoriasFlex + ' ' + styles.categoriasItemsCenter + ' ' + styles.categoriasGap}>
              <Label className={styles.categoriasModalLabel}>Aparecer dentro de</Label>
              <div className={styles.categoriasActionIcon}>
                ?
              </div>
            </div>
            <Select value={formData.dre} onValueChange={(value) => setFormData({ ...formData, dre: value })}>
              <SelectTrigger className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white focus:border-[#9C27B0] focus:ring-[#9C27B0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1B1229] border-[#673AB7]/30">
                {dreOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-white hover:bg-[#673AB7]/20">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> */}

          {/* {!isSubcategory && (
            <div className="space-y-2">
              <div className={styles.categoriasFlex + ' ' + styles.categoriasItemsCenter + ' ' + styles.categoriasGap}>
                <Label className={styles.categoriasModalLabel}>Associar com DRE Gerencial padrão</Label>
                <div className={styles.categoriasActionIcon}>
                  ?
                </div>
              </div>
              <Select
                value={formData.showInDre ? "show" : "hide"}
                onValueChange={(value) => setFormData({ ...formData, showInDre: value === "show" })}
              >
                <SelectTrigger className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white focus:border-[#9C27B0] focus:ring-[#9C27B0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1B1229] border-[#673AB7]/30">
                  <SelectItem value="show" className="text-white hover:bg-[#673AB7]/20">Mostrar no DRE Gerencial padrão</SelectItem>
                  <SelectItem value="hide" className="text-white hover:bg-[#673AB7]/20">Não mostrar no DRE Gerencial padrão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )} */}
        </div>

        <div className={styles.categoriasModalFooter}>
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isSaving}
            className={styles.categoriasModalButtonSecondary}
          >
            Cancelar
          </Button>
          <Button 
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
            className={styles.categoriasModalButtonPrimary}
          >
            {isSaving ? (
              <div className={styles.categoriasModalButtonLoading}>
                <div className={styles.categoriasModalButtonSpinner}></div>
                <span>Salvando...</span>
              </div>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DeleteModal = ({ isOpen, onClose, onConfirm, categoryName }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.categoriasDeleteModal}>
        <DialogHeader className={styles.categoriasDeleteModalHeader}>
          <DialogTitle className={styles.categoriasDeleteModalTitle}>Excluir categoria</DialogTitle>
        </DialogHeader>

        <div className={styles.categoriasDeleteModalBody}>
          <p className={styles.categoriasDeleteModalText}>
            Deseja excluir a categoria <strong className={styles.categoriasDeleteModalTextStrong}>{categoryName}</strong>?
          </p>
        </div>

        <div className={styles.categoriasDeleteModalFooter}>
          <Button 
            variant="outline" 
            onClick={onClose}
            className={styles.categoriasModalButtonSecondary}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={onConfirm}
            className={styles.categoriasModalButtonPrimary}
          >
            Excluir categoria
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function CategoriasFinanceiras() {
  const [showDre, setShowDre] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryModal, setCategoryModal] = useState({
    isOpen: false,
    type: 'receita'
  });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false
  });

  const [receitaCategories, setReceitaCategories] = useState([]);
  const [despesaCategories, setDespesaCategories] = useState([]);

  // Função para filtrar categorias
  const filterCategories = (categories) => {
    if (!searchTerm) return categories;
    
    return categories.filter(category => {
      const matchesMain = category.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSub = category.subcategorias?.some(sub => 
        sub.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return matchesMain || matchesSub;
    });
  };

  const filteredReceitaCategories = filterCategories(receitaCategories);
  const filteredDespesaCategories = filterCategories(despesaCategories);

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        setIsLoading(true);
        const companyId = localStorage.getItem("empresaId");
        const token = localStorage.getItem("token");

        console.log("🔍 companyId:", companyId);
        console.log("🔐 token:", token);

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/companies/${companyId}/categorias`,
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            }
          }
        );

        console.log("📡 response status:", res.status);

        if (!res.ok) {
          const erro = await res.text();
          console.error("❌ Erro na requisição:", erro);
          return;
        }

        const data = await res.json();
        console.log("📦 dados da API:", data);

        const receita = data.find((item) => item.tipo === 'Receita');
        const despesa = data.find((item) => item.tipo === 'Despesa');

        console.log("📁 categorias de receita:", receita);
        console.log("📂 categorias de despesa:", despesa);

        // Verifica se as categorias têm a estrutura correta
        const receitaCategorias = receita?.categorias || [];
        const despesaCategorias = despesa?.categorias || [];
        
        console.log("📁 categorias de receita processadas:", receitaCategorias);
        console.log("📂 categorias de despesa processadas:", despesaCategorias);

        setReceitaCategories(receitaCategorias);
        setDespesaCategories(despesaCategorias);
      } catch (err) {
        console.error("🚨 Erro ao buscar categorias:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategorias();
  }, []);

  const [empresaId, setEmpresaId] = useState(null);

  useEffect(() => {
    const updateEmpresaId = () => {
      const stored = localStorage.getItem('empresaId');
      setEmpresaId(stored);
    };

    window.addEventListener('storage', updateEmpresaId);
    updateEmpresaId(); // chama na primeira vez

    return () => window.removeEventListener('storage', updateEmpresaId);
  }, []);


  useEffect(() => {
    const checkEmpresaChange = () => {
      const currentEmpresaId = localStorage.getItem('empresaId');
      if (currentEmpresaId !== empresaId) {
        setEmpresaId(currentEmpresaId);
      }
    };

    // Checa a cada 1s se o empresaId foi trocado em outro lugar
    const interval = setInterval(checkEmpresaChange, 1000);
    return () => clearInterval(interval);
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;

    const fetchTipos = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos?company_id=${empresaId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        const data = await res.json();
        setReceitaTipo(data.find(t => t.nome === 'Receita' && t.company_id === Number(empresaId)));
        setDespesaTipo(data.find(t => t.nome === 'Despesa' && t.company_id === Number(empresaId)));
      } catch (err) {
        console.error("Erro ao carregar tipos:", err);
      }
    };

    fetchTipos();
  }, [empresaId]);

  // Logs para debug da renderização
  useEffect(() => {
    console.log('🎨 Renderizando categorias de receita:', receitaCategories);
  }, [receitaCategories]);

  useEffect(() => {
    console.log('🎨 Renderizando categorias de despesa:', despesaCategories);
  }, [despesaCategories]);


  const [receitaTipo, setReceitaTipo] = useState(null);
  const [despesaTipo, setDespesaTipo] = useState(null);

  // Função para salvar a categoria




  const handleSaveCategory = async (categoryData) => {
    const isReceita = categoryModal.type === 'receita';
    const currentList = isReceita ? receitaCategories : despesaCategories;
    const companyId = localStorage.getItem('empresaId');

          if (!companyId) {
        console.error("❌ companyId não encontrado!");
        toast.error("Empresa não selecionada.");
        return;
      }

      if (isReceita && !receitaTipo?.id) {
        console.error("❌ Tipo de Receita não carregado!");
        toast.error("Tipo de Receita não carregado.");
        return;
      }

      if (!isReceita && !despesaTipo?.id) {
        console.error("❌ Tipo de Despesa não carregado!");
        toast.error("Tipo de Despesa não carregado.");
        return;
      }

    const isSub = categoryModal.isSubcategory;
    const parentCategoryId = categoryModal.parentId;

    const isEditing = !!categoryModal.category?.id;
    const idToEdit = categoryModal.category?.id;

    const payload = {
      ...categoryData,
      ordem: currentList.length + 1,
      ...(isSub
        ? { categoria_id: parentCategoryId }
        : {
          tipo_id: isReceita ? receitaTipo.id : despesaTipo.id,
          company_id: Number(companyId)
        })
    };

    console.log("📦 Payload enviado:", payload);

    const urlBase = isSub
      ? `${process.env.NEXT_PUBLIC_API_URL}/sub-categorias`
      : `${process.env.NEXT_PUBLIC_API_URL}/categorias`;

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${urlBase}/${idToEdit}` : urlBase;

    try {
      setIsSaving(true);
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Erro ao salvar:', error);
        toast.error(`Erro ao salvar: ${error}`);
        return;
      }

      const resultado = await response.json();
      console.log('✅ Salvo:', resultado);
      console.log('🔍 Estado atual receita:', receitaCategories);
      console.log('🔍 Estado atual despesa:', despesaCategories);
      
      // Verifica se o resultado tem a estrutura esperada
      if (!resultado.id) {
        console.error('❌ Resultado não tem ID:', resultado);
        toast.error('Erro: resposta da API não contém ID da categoria');
        return;
      }
      
      // Garante que o resultado tenha todos os campos necessários
      const categoriaCompleta = {
        id: resultado.id,
        code: resultado.code || '',
        nome: resultado.nome || categoryData.nome,
        dre: resultado.dre || categoryData.dre,
        showInDre: resultado.showInDre ?? categoryData.showInDre,
        subcategorias: resultado.subcategorias || [],
        categoria_id: resultado.categoria_id
      };
      
      console.log('🔍 Categoria completa para adicionar:', categoriaCompleta);

      // Atualiza estado local (add ou update)
      if (isSub) {
        const parentId = parentCategoryId; // Usar parentCategoryId em vez de categoryModal.category?.id
        const setCategories = isReceita ? setReceitaCategories : setDespesaCategories;
        
        console.log('🔍 Atualizando subcategoria para parentId:', parentId);
        console.log('🔍 Resultado da subcategoria:', resultado);

        setCategories(prev => {
          const updated = prev.map(cat =>
            cat.id === parentId
              ? {
                ...cat,
                subcategorias: isEditing
                  ? cat.subcategorias?.map(sub => sub.id === categoriaCompleta.id ? categoriaCompleta : sub)
                  : [...(cat.subcategorias || []), categoriaCompleta]
              }
              : cat
          );
          console.log('🔍 Estado atualizado:', updated);
          return updated;
        });
      } else {
        const setCategories = isReceita ? setReceitaCategories : setDespesaCategories;
        
        console.log('🔍 Atualizando categoria principal');
        console.log('🔍 Resultado da categoria:', resultado);

        setCategories(prev => {
          const updated = isEditing
            ? prev.map(cat => (cat.id === categoriaCompleta.id ? categoriaCompleta : cat))
            : [...prev, categoriaCompleta];
          console.log('🔍 Estado atualizado:', updated);
          return updated;
        });
        
        // Força uma atualização imediata para debug
        setTimeout(() => {
          console.log('🔍 Estado após timeout - receita:', receitaCategories);
          console.log('🔍 Estado após timeout - despesa:', despesaCategories);
        }, 100);
      }

      // Toast de sucesso
      const toastMessage = isSub 
        ? `${isEditing ? 'Subcategoria' : 'Subcategoria'} "${categoryData.nome}" ${isEditing ? 'atualizada' : 'criada'} com sucesso!`
        : `${isEditing ? 'Categoria' : 'Categoria'} "${categoryData.nome}" ${isEditing ? 'atualizada' : 'criada'} com sucesso!`;
      
      console.log('🔔 Exibindo toast:', toastMessage);
      toast.success(toastMessage);

      setCategoryModal({ ...categoryModal, isOpen: false });

    } catch (err) {
      console.error('🚨 Erro inesperado ao salvar:', err);
      toast.error("Ocorreu um erro ao salvar a categoria.");
    } finally {
      setIsSaving(false);
    }
  };







  const handleDeleteCategory = async () => {
    if (!deleteModal.category?.id) {
      console.error("ID da categoria não encontrado.");
      toast.error("ID da categoria não encontrado.");
      return;
    }

    const isSub = deleteModal.isSubcategory;
    const isReceita = deleteModal.type === 'receita';
    const id = deleteModal.category.id;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/${isSub ? 'sub-categorias' : 'categorias'}/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      const result = await res.json();

      if (!res.ok) {
        console.error("Erro ao excluir:", result.error);
        toast.error(result.error || "Erro ao excluir a categoria.");
        return;
      }

      // Atualiza o estado local após a exclusão
      if (isSub) {
        const parentId = deleteModal.category?.categoria_id;
        if (isReceita) {
          setReceitaCategories(prev =>
            prev.map(cat =>
              cat.id === parentId
                ? {
                  ...cat,
                  subcategorias: cat.subcategorias?.filter(sub => sub.id !== id)
                }
                : cat
            )
          );
        } else {
          setDespesaCategories(prev =>
            prev.map(cat =>
              cat.id === parentId
                ? {
                  ...cat,
                  subcategorias: cat.subcategorias?.filter(sub => sub.id !== id)
                }
                : cat
            )
          );
        }
      } else {
        if (isReceita) {
          setReceitaCategories(prev => prev.filter(cat => cat.id !== id));
        } else {
          setDespesaCategories(prev => prev.filter(cat => cat.id !== id));
        }
      }

      toast.success(`${isSub ? 'Subcategoria' : 'Categoria'} "${deleteModal.category.nome}" excluída com sucesso!`);

    } catch (err) {
      console.error("Erro inesperado ao excluir:", err);
      toast.error("Ocorreu um erro ao excluir a categoria.");
    } finally {
      setDeleteModal({ isOpen: false });
    }
  };


  const CategoryItem = ({ category, type, isSubcategory = false }) => {
    if (isSubcategory) {
      return (
        <div className={styles.categoriasCategoryItemSub}>
          <div className={styles.categoriasFlex1}>
            <span className={styles.categoriasCategorySubTitle}>
              {category.nome}
            </span>
          </div>
          <div className={styles.categoriasCategoryActions}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryModal({
                isOpen: true,
                category,
                type,
                isSubcategory,
                parentId: category.categoria_id
              })}
              className={styles.categoriasCategoryActionBtn}
            >
              <Edit className={styles.categoriasActionIcon} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModal({
                isOpen: true,
                category,
                isSubcategory,
                type
              })}
              className={styles.categoriasCategoryActionBtn}
            >
              <Trash2 className={styles.categoriasActionIcon} />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.categoriasCategoryItemMain}>
        <div className={styles.categoriasFlex + ' ' + styles.categoriasItemsCenter + ' ' + styles.categoriasJustifyBetween}>
          <div className={styles.categoriasCategoryLeft}>
            <span className={styles.categoriasCategoryMainTitle}>
              {category.nome}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryModal({
                isOpen: true,
                type,
                isSubcategory: true,
                parentId: category.id
              })}
              className={styles.categoriasAddSubcategoryBtn}
            >
              <Plus className={styles.categoriasActionIcon} />
            </Button>
          </div>
          <div className={styles.categoriasCategoryActions}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryModal({
                isOpen: true,
                category,
                type,
                isSubcategory,
                parentId: undefined
              })}
              className={styles.categoriasCategoryActionBtn}
            >
              <Edit className={styles.categoriasActionIcon} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModal({
                isOpen: true,
                category,
                isSubcategory,
                type
              })}
              className={styles.categoriasCategoryActionBtn}
            >
              <Trash2 className={styles.categoriasActionIcon} />
            </Button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className={styles.categoriasPage}>
      {/* Header */}
      <div className={styles.categoriasHeader}>
        <div>
          <h1 className={styles.categoriasHeaderTitle}>Categorias</h1>
          <p className={styles.categoriasHeaderSubtitle}>Gerencie suas categorias de receita e despesa</p>
        </div>
      </div>

      {/* Search and Action Buttons */}
      <div className={styles.categoriasSearchActions}>
        <div className={styles.categoriasSearchContainer}>
          <div className={styles.categoriasSearchWrapper}>
            <Search className={styles.categoriasSearchIcon} />
            <Input
              placeholder="Pesquisar categorias..."
              className={styles.categoriasSearchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.categoriasActionsContainer}>
          {/* <Button
            variant="outline"
            onClick={() => setShowDre(!showDre)}
          >
            {showDre ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showDre ? 'Ocultar DRE' : 'Ocultar DRE'}
          </Button>
          <Button 
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurar categorias padrão
          </Button> */}
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Carregando categorias financeiras..." />
      ) : (
        <>
          {/* Categorias de Receita */}
          <Card className="theme-card">
            <CardHeader className={styles.categoriasCardHeader}>
              <CardTitle className="text-lg font-semibold theme-text-white">
                Categorias de receita
              </CardTitle>
              <Button
                variant="outline"
                onClick={() => setCategoryModal({
                  isOpen: true,
                  type: 'receita'
                })}
                className="theme-button-secondary"
              >
                Nova categoria de receita
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredReceitaCategories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <CategoryItem category={category} type="receita" />
                  <div className="pl-5">
                    {category.subcategorias?.map((subcategory) => (
                      <CategoryItem
                        key={subcategory.id}
                        category={subcategory}
                        type="receita"
                        isSubcategory
                      />
                    ))}
                  </div>
                </div>
              ))}
              {filteredReceitaCategories.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <p className="theme-text-secondary">Nenhuma categoria de receita encontrada para "{searchTerm}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Categorias de Despesa */}
          <Card className="theme-card">
            <CardHeader className={styles.categoriasCardHeader}>
              <CardTitle className="text-lg font-semibold theme-text-white">
                Categorias de despesa
              </CardTitle>
              <Button
                variant="outline"
                onClick={() => setCategoryModal({
                  isOpen: true,
                  type: 'despesa'
                })}
                className="theme-button-secondary"
              >
                Nova categoria de despesa
              </Button>

            </CardHeader>
            <CardContent className="space-y-4">
              {filteredDespesaCategories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <CategoryItem category={category} type="despesa" />
                  <div className="pl-5">
                    {category.subcategorias?.map((subcategory) => (
                      <CategoryItem
                        key={subcategory.id}
                        category={subcategory}
                        type="despesa"
                        isSubcategory
                      />
                    ))}
                  </div>
                </div>
              ))}
              {filteredDespesaCategories.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <p className="theme-text-secondary">Nenhuma categoria de despesa encontrada para "{searchTerm}"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modals */}
      <CategoryModal
        isOpen={categoryModal.isOpen}
        onClose={() => setCategoryModal({ ...categoryModal, isOpen: false })}
        onSave={handleSaveCategory}
        category={categoryModal.category}
        type={categoryModal.type}
        isSubcategory={categoryModal.isSubcategory}
        isSaving={isSaving}
      />

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleDeleteCategory}
        categoryName={deleteModal.category?.nome || ''}
      />
    </div>
  );
}