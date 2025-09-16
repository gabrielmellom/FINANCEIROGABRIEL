import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit2, Trash2, Check, DollarSign, TrendingUp, TrendingDown, Filter, X, BarChart3, Table, ChevronDown, ChevronUp, Download, Upload, ChevronRight, Calendar, Tag, FileText, CreditCard, Receipt } from 'lucide-react';

// Componente de gráfico de crescimento por categoria
const CategoryGrowthChart = ({ contas, mesAtual }) => {
  const [dadosGrafico, setDadosGrafico] = useState([]);

  useEffect(() => {
    const calcularCrescimentoPorCategoria = () => {
      const categorias = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Trabalho', 'Serviços'];
      const resultado = [];
      
      categorias.forEach(categoria => {
        const mesAtualInicio = startOfMonth(mesAtual);
        const mesAtualFim = endOfMonth(mesAtual);
        const mesAnteriorInicio = startOfMonth(subMonths(mesAtual, 1));
        const mesAnteriorFim = endOfMonth(subMonths(mesAtual, 1));
        
        // Calcular totais do mês atual
        const contasMesAtual = contas.filter(conta => {
          if (conta.categoria !== categoria) return false;
          const dataVencimento = parseISO(conta.dataVencimento);
          return isWithinInterval(dataVencimento, { start: mesAtualInicio, end: mesAtualFim });
        });
        
        const totalMesAtual = contasMesAtual.reduce((sum, c) => sum + parseFloat(c.valor), 0);
        
        // Calcular totais do mês anterior
        const contasMesAnterior = contas.filter(conta => {
          if (conta.categoria !== categoria) return false;
          const dataVencimento = parseISO(conta.dataVencimento);
          return isWithinInterval(dataVencimento, { start: mesAnteriorInicio, end: mesAnteriorFim });
        });
        
        const totalMesAnterior = contasMesAnterior.reduce((sum, c) => sum + parseFloat(c.valor), 0);
        
        // Calcular crescimento
        let crescimento = 0;
        if (totalMesAnterior > 0) {
          crescimento = ((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100;
        } else if (totalMesAtual > 0) {
          crescimento = 100; // Crescimento infinito (de 0 para algum valor)
        }
        
        resultado.push({
          categoria,
          totalMesAtual,
          totalMesAnterior,
          crescimento
        });
      });
      
      setDadosGrafico(resultado);
    };
    
    calcularCrescimentoPorCategoria();
  }, [contas, mesAtual]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="font-semibold text-gray-800 mb-4">Crescimento por Categoria vs Mês Anterior</h3>
      <div className="space-y-3">
        {dadosGrafico.map(item => (
          <div key={item.categoria} className="flex items-center justify-between">
            <span className="text-sm font-medium w-24 truncate">{item.categoria}</span>
            <div className="flex-1 mx-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${item.crescimento >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(item.crescimento), 100)}%` }}
                ></div>
              </div>
            </div>
            <span className={`text-xs font-medium ${item.crescimento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {item.crescimento >= 0 ? '+' : ''}{item.crescimento.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Componente Accordion para organizar as contas por categoria
const AccordionCategoria = ({ titulo, contas, togglePago, editarConta, excluirConta, tipo, isOpen, onToggle }) => {
  const totalCategoria = contas.reduce((sum, c) => sum + parseFloat(c.valor), 0);
  const contasPagas = contas.filter(c => c.pago);
  const totalPago = contasPagas.reduce((sum, c) => sum + parseFloat(c.valor), 0);
  const percentualPago = totalCategoria > 0 ? (totalPago / totalCategoria) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center">
          <div className={`p-2 rounded-lg mr-3 ${tipo === 'receber' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {tipo === 'receber' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">{titulo}</h3>
            <p className="text-sm text-gray-500">{contas.length} {contas.length === 1 ? 'conta' : 'contas'}</p>
          </div>
        </div>
        <div className="flex items-center">
          <div className="text-right mr-4">
            <p className={`font-bold ${tipo === 'receber' ? 'text-green-600' : 'text-red-600'}`}>
              R$ {totalCategoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500">
              {percentualPago.toFixed(0)}% pago
            </p>
          </div>
          <ChevronRight 
            size={20} 
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} 
          />
        </div>
      </button>
      
      {isOpen && (
        <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Descrição</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contas.map((conta) => (
                  <tr key={conta.id} className={conta.pago ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button
                        onClick={() => togglePago(conta)}
                        className={`p-1 rounded-full ${conta.pago ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                        title={conta.pago ? 'Marcar como não pago' : 'Marcar como pago'}
                      >
                        <Check size={14} />
                      </button>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {format(parseISO(conta.dataVencimento), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        <span className={`text-sm ${conta.pago ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {conta.descricao}
                        </span>
                        {conta.totalParcelas > 1 && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1 rounded">
                            {conta.parcelaAtual}/{conta.totalParcelas}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-right">
                      <span className={tipo === 'receber' ? 'text-green-600' : 'text-red-600'}>
                        R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => editarConta(conta)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Editar conta"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => excluirConta(conta)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Excluir conta"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente principal do Dashboard
const Dashboard = () => {
  const [contas, setContas] = useState([]);
  const [categorias] = useState(['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Trabalho', 'Serviços']);
  const [mesAtual, setMesAtual] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingConta, setEditingConta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);
  const [visualizacao, setVisualizacao] = useState('sanfona'); // 'sanfona' ou 'graficos'
  const [categoriasAbertas, setCategoriasAbertas] = useState({});
  
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'receber',
    categoria: '',
    dataVencimento: '',
    recorrente: false,
    numParcelas: 1,
    intervaloParcelas: 1,
    pago: false
  });

  // Buscar contas do Firebase
  useEffect(() => {
    let q;
    if (filtroCategoria) {
      q = query(
        collection(db, 'contas'), 
        where('categoria', '==', filtroCategoria),
        orderBy('dataVencimento')
      );
    } else {
      q = query(collection(db, 'contas'), orderBy('dataVencimento'));
    }
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const contasData = [];
      querySnapshot.forEach((doc) => {
        contasData.push({ id: doc.id, ...doc.data() });
      });
      setContas(contasData);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar contas:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filtroCategoria]);

  // Inicializar estado das categorias abertas
  useEffect(() => {
    const initialState = {};
    categorias.forEach(cat => {
      initialState[cat] = false;
    });
    setCategoriasAbertas(initialState);
  }, [categorias]);

  // Gerar e salvar parcelas no banco de dados
  const gerarESalvarParcelas = async (contaBase) => {
    const dataBase = parseISO(contaBase.dataVencimento);
    const parcelas = [];
    
    for (let i = 0; i < contaBase.numParcelas; i++) {
      const dataVencimento = addMonths(dataBase, i * contaBase.intervaloParcelas);
      const parcela = {
        ...contaBase,
        id: undefined, // Firebase gerará novo ID
        descricao: `${contaBase.descricao} (${i + 1}/${contaBase.numParcelas})`,
        dataVencimento: format(dataVencimento, 'yyyy-MM-dd'),
        parcelaAtual: i + 1,
        totalParcelas: contaBase.numParcelas,
        recorrente: false, // Cada parcela é tratada como conta individual
        createdAt: new Date()
      };
      
      delete parcela.id; // Remover ID para criar novo documento
      
      try {
        const docRef = await addDoc(collection(db, 'contas'), parcela);
        parcelas.push({ id: docRef.id, ...parcela });
      } catch (error) {
        console.error('Erro ao criar parcela:', error);
      }
    }
    
    return parcelas;
  };

  // Obter todas as contas do mês
  const getContasMes = () => {
    const inicioMes = startOfMonth(mesAtual);
    const fimMes = endOfMonth(mesAtual);
    
    return contas.filter(conta => {
      const dataVencimento = parseISO(conta.dataVencimento);
      return isWithinInterval(dataVencimento, { start: inicioMes, end: fimMes });
    });
  };

  // Salvar conta
  const salvarConta = async (e) => {
    e.preventDefault();
    
    try {
      const dadosConta = {
        ...formData,
        valor: parseFloat(formData.valor),
        numParcelas: parseInt(formData.numParcelas),
        intervaloParcelas: parseInt(formData.intervaloParcelas),
        createdAt: new Date()
      };

      if (editingConta) {
        // Atualizar conta existente
        await updateDoc(doc(db, 'contas', editingConta.id), dadosConta);
      } else if (formData.recorrente) {
        // Criar parcelas no banco
        await gerarESalvarParcelas(dadosConta);
      } else {
        // Criar conta única
        await addDoc(collection(db, 'contas'), dadosConta);
      }

      resetForm();
    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      alert('Erro ao salvar conta. Verifique sua conexão.');
    }
  };

  // Marcar como pago/não pago
  const togglePago = async (conta) => {
    try {
      await updateDoc(doc(db, 'contas', conta.id), { pago: !conta.pago });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status. Tente novamente.');
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor: '',
      tipo: 'receber',
      categoria: '',
      dataVencimento: '',
      recorrente: false,
      numParcelas: 1,
      intervaloParcelas: 1,
      pago: false
    });
    setShowForm(false);
    setEditingConta(null);
  };

  const editarConta = (conta) => {
    setFormData({
      ...conta,
      valor: conta.valor.toString(),
      numParcelas: conta.numParcelas?.toString() || '1',
      intervaloParcelas: conta.intervaloParcelas?.toString() || '1'
    });
    setEditingConta(conta);
    setShowForm(true);
  };

  const excluirConta = async (conta) => {
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
      try {
        await deleteDoc(doc(db, 'contas', conta.id));
      } catch (error) {
        console.error('Erro ao excluir conta:', error);
        alert('Erro ao excluir conta.');
      }
    }
  };

  const limparFiltro = () => {
    setFiltroCategoria('');
    setShowFiltros(false);
  };

  const toggleCategoria = (categoria) => {
    setCategoriasAbertas(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando sistema financeiro...</p>
        </div>
      </div>
    );
  }

  const contasMes = getContasMes();
  const contasReceber = contasMes.filter(c => c.tipo === 'receber');
  const contasPagar = contasMes.filter(c => c.tipo === 'pagar');
  
  const totalReceber = contasReceber.reduce((sum, c) => sum + (c.pago ? 0 : parseFloat(c.valor)), 0);
  const totalPagar = contasPagar.reduce((sum, c) => sum + (c.pago ? 0 : parseFloat(c.valor)), 0);
  const totalReceberPago = contasReceber.reduce((sum, c) => sum + (c.pago ? parseFloat(c.valor) : 0), 0);
  const totalPagarPago = contasPagar.reduce((sum, c) => sum + (c.pago ? parseFloat(c.valor) : 0), 0);
  const saldoPrevisto = totalReceber - totalPagar;
  const saldoRealizado = totalReceberPago - totalPagarPago;

  // Agrupar contas por categoria
  const contasReceberPorCategoria = categorias.map(categoria => ({
    categoria,
    contas: contasReceber.filter(conta => conta.categoria === categoria)
  })).filter(item => item.contas.length > 0);

  const contasPagarPorCategoria = categorias.map(categoria => ({
    categoria,
    contas: contasPagar.filter(conta => conta.categoria === categoria)
  })).filter(item => item.contas.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header simplificado */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">💰 Controle Financeiro</h1>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowFiltros(!showFiltros)}
                  className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow hover:bg-gray-50 transition-colors text-sm"
                >
                  <Filter size={16} />
                  {filtroCategoria || 'Filtrar'}
                  {filtroCategoria && (
                    <button onClick={limparFiltro} className="text-gray-500">
                      <X size={14} />
                    </button>
                  )}
                </button>
                
                {showFiltros && (
                  <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg p-2 z-10 min-w-[160px]">
                    <div className="space-y-1">
                      <button
                        onClick={limparFiltro}
                        className={`block w-full text-left px-3 py-1 rounded text-sm ${!filtroCategoria ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
                      >
                        Todas categorias
                      </button>
                      
                      {categorias.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            setFiltroCategoria(cat);
                            setShowFiltros(false);
                          }}
                          className={`block w-full text-left px-3 py-1 rounded text-sm ${filtroCategoria === cat ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex bg-white rounded-lg shadow">
                <button
                  onClick={() => setVisualizacao('sanfona')}
                  className={`p-2 rounded-l ${visualizacao === 'sanfona' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                  title="Visualização em sanfona"
                >
                  <Table size={16} />
                </button>
                <button
                  onClick={() => setVisualizacao('graficos')}
                  className={`p-2 rounded-r ${visualizacao === 'graficos' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                  title="Visualização em gráficos"
                >
                  <BarChart3 size={16} />
                </button>
              </div>
              
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md text-sm"
              >
                <Plus size={16} />
                Nova
              </button>
            </div>
          </div>

          {/* Navegação de meses e resumo */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMesAtual(addMonths(mesAtual, -1))}
                className="p-1 bg-white rounded shadow hover:bg-gray-50"
              >
                ←
              </button>
              <h2 className="text-lg font-semibold text-gray-800 min-w-[160px] text-center capitalize">
                {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <button
                onClick={() => setMesAtual(addMonths(mesAtual, 1))}
                className="p-1 bg-white rounded shadow hover:bg-gray-50"
              >
                →
              </button>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className={`px-2 py-1 rounded ${saldoPrevisto >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                Saldo: R$ {saldoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-gray-500">
                📊 {contasMes.length} itens
              </div>
            </div>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="text-green-600" size={18} />
                <span className="font-medium text-green-800">A Receber</span>
              </div>
              <p className="text-xl font-bold text-green-600">
                R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600">
                Recebido: R$ {totalReceberPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="text-red-600" size={18} />
                <span className="font-medium text-red-800">A Pagar</span>
              </div>
              <p className="text-xl font-bold text-red-600">
                R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-red-600">
                Pago: R$ {totalPagarPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${saldoPrevisto >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={saldoPrevisto >= 0 ? 'text-blue-600' : 'text-orange-600'} size={18} />
                <span className={`font-medium ${saldoPrevisto >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                  Saldo Previsto
                </span>
              </div>
              <p className={`text-xl font-bold ${saldoPrevisto >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                R$ {saldoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${saldoRealizado >= 0 ? 'bg-purple-50 border-purple-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Check className={saldoRealizado >= 0 ? 'text-purple-600' : 'text-yellow-600'} size={18} />
                <span className={`font-medium ${saldoRealizado >= 0 ? 'text-purple-800' : 'text-yellow-800'}`}>
                  Saldo Realizado
                </span>
              </div>
              <p className={`text-xl font-bold ${saldoRealizado >= 0 ? 'text-purple-600' : 'text-yellow-600'}`}>
                R$ {saldoRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Conteúdo principal baseado na visualização escolhida */}
        {visualizacao === 'sanfona' ? (
          <div className="grid grid-cols-1 gap-6">
            {/* Contas a Receber */}
            <div>
              <h2 className="text-lg font-semibold text-green-600 mb-3 flex items-center gap-2">
                <TrendingUp size={20} />
                Contas a Receber
                <span className="text-sm font-normal text-gray-500">({contasReceber.length})</span>
              </h2>
              
              {contasReceberPorCategoria.length > 0 ? (
                contasReceberPorCategoria.map(({ categoria, contas }) => (
                  <AccordionCategoria
                    key={`receber-${categoria}`}
                    titulo={categoria}
                    contas={contas}
                    togglePago={togglePago}
                    editarConta={editarConta}
                    excluirConta={excluirConta}
                    tipo="receber"
                    isOpen={categoriasAbertas[categoria]}
                    onToggle={() => toggleCategoria(categoria)}
                  />
                ))
              ) : (
                <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
                  <p>Nenhuma conta a receber neste mês</p>
                </div>
              )}
            </div>
            
            {/* Contas a Pagar */}
            <div>
              <h2 className="text-lg font-semibold text-red-600 mb-3 flex items-center gap-2">
                <TrendingDown size={20} />
                Contas a Pagar
                <span className="text-sm font-normal text-gray-500">({contasPagar.length})</span>
              </h2>
              
              {contasPagarPorCategoria.length > 0 ? (
                contasPagarPorCategoria.map(({ categoria, contas }) => (
                  <AccordionCategoria
                    key={`pagar-${categoria}`}
                    titulo={categoria}
                    contas={contas}
                    togglePago={togglePago}
                    editarConta={editarConta}
                    excluirConta={excluirConta}
                    tipo="pagar"
                    isOpen={categoriasAbertas[categoria]}
                    onToggle={() => toggleCategoria(categoria)}
                  />
                ))
              ) : (
                <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
                  <p>Nenhuma conta a pagar neste mês</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-semibold text-gray-800 mb-4">Visão Geral do Mês</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm text-green-700 mb-1">A Receber</div>
                    <div className="text-lg font-bold text-green-800">
                      R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-green-600">
                      Recebido: R$ {totalReceberPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-sm text-red-700 mb-1">A Pagar</div>
                    <div className="text-lg font-bold text-red-800">
                      R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-red-600">
                      Pago: R$ {totalPagarPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${saldoPrevisto >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <div className={`text-sm ${saldoPrevisto >= 0 ? 'text-blue-700' : 'text-orange-700'} mb-1`}>
                      Saldo Previsto
                    </div>
                    <div className={`text-lg font-bold ${saldoPrevisto >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                      R$ {saldoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg ${saldoRealizado >= 0 ? 'bg-purple-50' : 'bg-yellow-50'}`}>
                    <div className={`text-sm ${saldoRealizado >= 0 ? 'text-purple-700' : 'text-yellow-700'} mb-1`}>
                      Saldo Realizado
                    </div>
                    <div className={`text-lg font-bold ${saldoRealizado >= 0 ? 'text-purple-800' : 'text-yellow-800'}`}>
                      R$ {saldoRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <CategoryGrowthChart contas={contas} mesAtual={mesAtual} />
            </div>
          </div>
        )}

        {/* Formulário */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingConta ? '✏️ Editar Conta' : '➕ Nova Conta'}
              </h3>
              
              <form onSubmit={salvarConta}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <input
                      type="text"
                      placeholder="Ex: Salário, Aluguel, Cliente XYZ..."
                      value={formData.descricao}
                      onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.valor}
                      onChange={(e) => setFormData({...formData, valor: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="receber">💰 A Receber</option>
                      <option value="pagar">💸 A Pagar</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione uma categoria</option>
                      {categorias.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento</label>
                    <input
                      type="date"
                      value={formData.dataVencimento}
                      onChange={(e) => setFormData({...formData, dataVencimento: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="recorrente"
                      checked={formData.recorrente}
                      onChange={(e) => setFormData({...formData, recorrente: e.target.checked})}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="recorrente" className="text-sm font-medium text-gray-700">
                      🔄 Conta recorrente (parcelas)
                    </label>
                  </div>
                  
                  {formData.recorrente && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Nº Parcelas</label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          placeholder="12"
                          value={formData.numParcelas}
                          onChange={(e) => setFormData({...formData, numParcelas: e.target.value})}
                          className="w-full p-2 border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Intervalo (meses)</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          placeholder="1"
                          value={formData.intervaloParcelas}
                          onChange={(e) => setFormData({...formData, intervaloParcelas: e.target.value})}
                          className="w-full p-2 border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingConta ? '💾 Salvar' : '➕ Criar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-300 text-gray-700 p-3 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>💡 Dica: Clique nas categorias para expandir/recolher as contas</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;