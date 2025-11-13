'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
} from 'lucide-react';
import { useEffect,useMemo, useState } from 'react';

import { AlertModal } from './modals/AlertModal';
import { useAlertModal } from '../hooks/useAlertModal';
import { useLoadingState } from '../hooks/useLoadingState';
import { AdminConfig, CustomCategory } from '../types';
import { buttonStyles } from '../utils/constants';
import { showError } from '../utils/helpers';

const CategoryConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [newCategory, setNewCategory] = useState<CustomCategory>({
    name: '',
    type: 'movie',
    query: '',
    disabled: false,
    from: 'config',
  });

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.CustomCategories) {
      setCategories(config.CustomCategories);
      // 进入时重置 orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 过滤分类
  const filteredCategories = useMemo(() => {
    if (!searchKeyword.trim()) {
      return categories;
    }
    const keyword = searchKeyword.toLowerCase().trim();
    return categories.filter(
      (category) =>
        (category.name && category.name.toLowerCase().includes(keyword)) ||
        category.query.toLowerCase().includes(keyword) ||
        (category.type === 'movie' ? '电影' : '电视剧').includes(keyword)
    );
  }, [categories, searchKeyword]);

  // 通用 API 请求
  const callCategoryApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (query: string, type: 'movie' | 'tv') => {
    const target = categories.find((c) => c.query === query && c.type === type);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleCategory_${query}_${type}`, () =>
      callCategoryApi({ action, query, type })
    ).catch(() => {
      console.error('操作失败', action, query, type);
    });
  };

  const handleDelete = (query: string, type: 'movie' | 'tv') => {
    withLoading(`deleteCategory_${query}_${type}`, () =>
      callCategoryApi({ action: 'delete', query, type })
    ).catch(() => {
      console.error('操作失败', 'delete', query, type);
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.query) return;
    withLoading('addCategory', async () => {
      await callCategoryApi({
        action: 'add',
        name: newCategory.name,
        type: newCategory.type,
        query: newCategory.query,
      });
      setNewCategory({
        name: '',
        type: 'movie',
        query: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newCategory);
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === active.id
    );
    const newIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === over.id
    );
    setCategories((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = categories.map((c) => `${c.query}:${c.type}`);
    withLoading('saveCategoryOrder', () =>
      callCategoryApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ category }: { category: CustomCategory }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: `${category.query}:${category.type}` });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className='flex items-center px-2 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        <div
          className='w-6 flex-shrink-0 flex justify-center cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...{ ...attributes, ...listeners }}
        >
          <GripVertical size={16} />
        </div>
        <div className='w-32 flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis'>
          {category.name || '-'}
        </div>
        <div className='w-24 flex-shrink-0 px-2'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              category.type === 'movie'
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
            }`}
          >
            {category.type === 'movie' ? '电影' : '电视剧'}
          </span>
        </div>
        <div
          className='flex-1 min-w-0 px-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap overflow-hidden text-ellipsis'
          title={category.query}
        >
          {category.query}
        </div>
        <div className='w-20 flex-shrink-0 px-2'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !category.disabled
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!category.disabled ? '启用中' : '已禁用'}
          </span>
        </div>
        <div className='w-48 flex-shrink-0 px-2 flex justify-end gap-2'>
          <button
            onClick={() => handleToggleEnable(category.query, category.type)}
            disabled={isLoading(
              `toggleCategory_${category.query}_${category.type}`
            )}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !category.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleCategory_${category.query}_${category.type}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!category.disabled ? '禁用' : '启用'}
          </button>
          {category.from !== 'config' && (
            <button
              onClick={() => handleDelete(category.query, category.type)}
              disabled={isLoading(
                `deleteCategory_${category.query}_${category.type}`
              )}
              className={`${buttonStyles.roundedSecondary} ${
                isLoading(`deleteCategory_${category.query}_${category.type}`)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              删除
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 标题和搜索栏 */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          自定义分类列表 ({categories.length})
        </h4>
        <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2'>
          <input
            type='text'
            placeholder='搜索分类名称、关键词或类型...'
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className='px-[10px] py-[5px] text-sm border border-gray-300 focus:!border-blue-500 dark:border-gray-600 dark:focus:!border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 w-full sm:w-64'
            style={{ outline: 'none', boxShadow: 'none' }}
            onFocus={(e) => {
              e.target.style.outline = 'none';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              showAddForm ? buttonStyles.secondary : buttonStyles.success
            }`}
          >
            {showAddForm ? '取消' : '添加分类'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='分类名称'
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <select
              value={newCategory.type}
              onChange={(e) =>
                setNewCategory((prev) => ({
                  ...prev,
                  type: e.target.value as 'movie' | 'tv',
                }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            >
              <option value='movie'>电影</option>
              <option value='tv'>电视剧</option>
            </select>
            <input
              type='text'
              placeholder='搜索关键词'
              value={newCategory.query}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, query: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddCategory}
              disabled={
                !newCategory.name ||
                !newCategory.query ||
                isLoading('addCategory')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newCategory.name ||
                !newCategory.query ||
                isLoading('addCategory')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addCategory') ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 分类列表 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'>
          {/* 表头 */}
          <div className='sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[800px]'>
            <div className='flex items-center px-2 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              <div className='w-6 flex-shrink-0 flex justify-center'></div>
              <div className='w-32 flex-shrink-0 px-2'>分类名称</div>
              <div className='w-24 flex-shrink-0 px-2'>类型</div>
              <div className='flex-1 min-w-0 px-2'>搜索关键词</div>
              <div className='w-20 flex-shrink-0 px-2'>状态</div>
              <div className='w-48 flex-shrink-0 px-2 text-right'>操作</div>
            </div>
          </div>

          {/* 内容 */}
          <SortableContext
            items={filteredCategories.map((c) => `${c.query}:${c.type}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className='divide-y divide-gray-200 dark:divide-gray-700 min-w-[800px]'>
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category) => (
                  <DraggableRow
                    key={`${category.query}:${category.type}`}
                    category={category}
                  />
                ))
              ) : (
                <div className='px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
                  {searchKeyword.trim() ? '没有找到匹配的分类' : '暂无分类'}
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </DndContext>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            disabled={isLoading('saveCategoryOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveCategoryOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveCategoryOrder') ? '保存中...' : '保存排序'}
          </button>
        </div>
      )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 新增配置文件组件
// 配置文件组件已移除，功能已整合到视频源和直播源配置中

export default CategoryConfig;
