import { useEffect, useRef } from "react";
import * as d3 from "d3";

const width = 1800;
const height = 800;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 40;
const marginLeft = 60;

// 计算持有金值的函数
function calculateHoldingValue(data, initialInvestment, purchaseIndex) {
  // 反转数据（第一行是最后一天）
  data = data.reverse();
  // 找到购买日期的数据
  const purchaseData = data[purchaseIndex];

  // 检查是否找到了购买日期的数据
  if (!purchaseData) {
    throw new Error(`No data found for index: ${purchaseIndex}`);
  }

  // 计算购买的股票数量，取整
  const shares = Math.floor(initialInvestment / purchaseData.Close);

  // 计算每天的持有金值和收益率
  data.forEach((d, index) => {
    if (index >= purchaseIndex) {
      d.holdingValue = d.Close * shares;
      d.returnRate = (d.holdingValue - initialInvestment) / initialInvestment; // 计算收益率
    } else {
      d.holdingValue = 0;
      d.returnRate = 0; // 在购买日期之前，收益率为0
    }
  });

  return data;
}

const Graph = () => {
  const ref = useRef();

  useEffect(() => {
    // 加载.csv文件
    d3.csv("/alibaba.csv").then((data) => {
      // 将日期和价格转换为正确的类型
      data.forEach((d) => {
        d.Date = d3.timeParse("%Y-%m-%d")(d.Date);
        d.Close = +d.Close;
      });

      // 获取数据的日期范围
      const purchaseIndexStart = 0; // 第二行

      // 计算每天的持有金值
      const holdingData = calculateHoldingValue(
        data,
        10000,
        purchaseIndexStart
      );

      const svg = d3
        .select(ref.current)
        .attr("width", width)
        .attr("height", height)
        .attr("class", "svg-container"); // 使用样式

      const xScale = d3
        .scaleUtc()
        .domain(d3.extent(holdingData, (d) => d.Date))
        .range([marginLeft, width - marginRight]);

      const yScale = d3
        .scaleLog()
        .domain([
          d3.min(holdingData, (d) => d.holdingValue),
          d3.max(holdingData, (d) => d.holdingValue),
        ])
        .range([height - marginBottom, marginTop]);

      // 创建一个线生成器
      const line = d3
        .line()
        .x((d) => xScale(d.Date))
        .y((d) => yScale(d.holdingValue))
        .curve(d3.curveMonotoneX); // 设置线的曲率

      // 为每个数据点创建一个小段
      let paths = holdingData.map((d, i) => {
        if (i < holdingData.length - 1) {
          return svg
            .append("path")
            .datum([d, d]) // 初始时，线段的开始点和结束点都是当前数据点
            .attr("fill", "none")
            .attr("stroke", d.holdingValue > 10000 ? "red" : "green") // 根据holdingValue的值来设置线段的颜色
            .attr("stroke-width", 3)
            .attr("d", line);
        }
      });

      // 在svg中添加一个圆圈和一个文本元素
      let circle = svg.append("circle").attr("r", 5).attr("fill", "red");

      let text = svg
        .append("text")
        .attr("dx", 10)
        .attr("dy", ".50em")
        .style("font-weight", "bold")
        .style("font-size", "22px");

      // 创建一个定时器
      let lineTimer = d3.interval((elapsed) => {
        let index = Math.floor(elapsed / 500);
        // 获取最新的数据点
        let latestData = holdingData[index + 1];
        // 更新时间的文本内容
        d3.select("#dateText").text(
          `${d3.timeFormat("%Y-%m-%d")(latestData.Date)}`
        );
        // 更新收益率的文本内容
        d3.select("#returnText")
          .text(`收益率：${(latestData.returnRate * 100).toFixed(2)}%`)
          .attr("fill", latestData.returnRate > 0 ? "red" : "green");

        if (index < holdingData.length - 1) {
          paths[index]
            .datum([holdingData[index], holdingData[index + 1]]) // 将线段的结束点移动到下一个数据点
            .transition()
            .duration(400) // 设置过渡的持续时间
            .attr("d", line); // 更新线的形状

          // 获取最新的数据点
          let latestData = holdingData[index + 1];

          // 更新圆圈的位置
          circle
            .transition()
            .duration(100)
            .attr("cx", xScale(latestData.Date))
            .attr("cy", yScale(latestData.holdingValue))
            .attr("fill", latestData.holdingValue > 10000 ? "red" : "green");

          // 更新文本的内容和位置
          text
            .transition()
            .duration(200)
            .attr("x", xScale(latestData.Date) + 10) // 在这里添加一个偏移量
            .attr("y", yScale(latestData.holdingValue))
            .text(Math.floor(latestData.holdingValue)) // 使用Math.floor()函数取整
            .attr("fill", latestData.holdingValue > 10000 ? "red" : "green");
        } else {
          lineTimer.stop();
        }
      }, 200); // 设置定时器的间隔时间

      // 添加图表的表头
      svg
        .append("text")
        .attr("x", width / 2) // 设置文本的x坐标为图表的中心
        .attr("y", marginTop) // 设置文本的y坐标为图表的顶部
        .attr("text-anchor", "middle") // 设置文本的锚点为中心，这样文本就会在指定的坐标上居中
        .attr("font-size", "24px") // 设置字体大小
        .attr("font-weight", "bold") // 设置字体粗细
        .text("假如你三年前买了10000元Alibaba（美股）"); // 设置文本的内容

      // 添加x轴
      svg
        .append("g")
        .attr("transform", "translate(0," + (height - marginBottom) + ")")
        .call(
          d3
            .axisBottom(xScale)
            .ticks(d3.timeMonth.every(3))
            .tickFormat(d3.timeFormat("%Y-%m"))
        )
        .style("font-size", "18px"); // 设置字体大小为20px

      // 添加y轴
      svg
        .append("g")
        .attr("transform", "translate(" + marginLeft + ",0)")
        .call(d3.axisLeft(yScale))
        .style("font-size", "18px"); // 设置字体大小为20px

      // 添加时间的文本元素
      svg
        .append("text")
        .attr("id", "dateText") // 设置id，以便后续更新文本的内容
        .attr("x", width - marginRight) // 设置文本的x坐标为图表的右边
        .attr("y", marginTop) // 设置文本的y坐标为图表的顶部
        .attr("text-anchor", "end") // 设置文本的锚点为结束，这样文本就会在指定的坐标上右对齐
        .attr("font-size", "16px") // 设置字体大小
        .text(""); // 初始时，文本的内容为空

      // 添加收益率的文本元素
      svg
        .append("text")
        .attr("id", "returnText") // 设置id，以便后续更新文本的内容
        .attr("x", width - marginRight) // 设置文本的x坐标为图表的右边
        .attr("y", marginTop + 20) // 设置文本的y坐标为图表的顶部，再向下偏移20像素
        .attr("text-anchor", "end") // 设置文本的锚点为结束，这样文本就会在指定的坐标上右对齐
        .attr("font-size", "16px") // 设置字体大小
        .text(""); // 初始时，文本的内容为空

      return () => {
        // 当组件卸载时，停止定时器
        timer.stop();
      };
    });
  }, []);

  return <svg ref={ref} />;
};

export default Graph;
