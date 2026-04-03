import { useState, useEffect, useRef, useMemo } from 'react';

const VirtualList = ({ 
  items, 
  itemHeight = 80, 
  containerHeight = 400, 
  renderItem, 
  overscan = 5 
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef();

  const { visibleItems, totalHeight, offsetY } = useMemo(() => {
    const containerItemCount = Math.ceil(containerHeight / itemHeight);
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + containerItemCount + overscan,
      items.length - 1
    );

    const visibleItems = [];
    for (let i = Math.max(0, startIndex - overscan); i <= endIndex; i++) {
      visibleItems.push({
        index: i,
        item: items[i],
      });
    }

    const offsetY = Math.max(0, startIndex - overscan) * itemHeight;

    return { visibleItems, totalHeight, offsetY };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  const onScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={scrollElementRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={onScroll}
      className="virtual-list"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ index, item }) => (
            <div
              key={index}
              style={{ height: itemHeight }}
              className="virtual-list-item"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VirtualList;